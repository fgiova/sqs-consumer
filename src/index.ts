import { setTimeout as setTimeoutAsync } from "node:timers/promises";
import type { Signer, SignerOptions } from "@fgiova/aws-signature";
import { type Message, MiniSQSClient } from "@fgiova/mini-sqs-client";
// @ts-expect-error
import { Unpromise } from "@watchable/unpromise";
// @ts-expect-error
import pMap from "p-map";
import type { Pool } from "undici";
import { TimeoutError } from "./errors";
import { type HookCallback, type HookName, Hooks } from "./hooks";
import type { Logger } from "./logger";

type HandlerOptions = {
	deleteMessage?: boolean;
	extendVisibilityTimeout?: boolean;
	executionTimeout?: number;
	parallelExecution?: boolean;
};

type ClientOptions = {
	sqsClient?: MiniSQSClient;
	endpoint?: string;
	undiciOptions?: Pool.Options;
	signer?: Signer | SignerOptions;
	destroySigner?: boolean;
};

type ConsumerOptions = {
	visibilityTimeout?: number;
	waitTimeSeconds?: number;
	itemsPerRequest?: number;
	messageAttributeNames?: string[];
	attributeNames?: string[];
};

type ConsumerHookName = Exclude<HookName, "onStart" | "onStop">;

export type HooksOptions = {
	[H in ConsumerHookName]?: HookCallback<H>;
};

export type SQSConsumerOptions = {
	queueARN: string;
	// biome-ignore lint/suspicious/noExplicitAny: type is unpredictable here
	handler: (message: Message) => Promise<any>;
	logger?: Logger;
	autostart?: boolean;
	handlerOptions?: HandlerOptions;
	clientOptions?: ClientOptions;
	consumerOptions?: ConsumerOptions;
	hooks?: HooksOptions;
};

export class SQSConsumer {
	private readonly queueARN: string;
	private readonly handlerOptions: HandlerOptions;
	private readonly clientOptions: Pick<ClientOptions, "destroySigner">;
	private readonly consumerOptions: ConsumerOptions;
	private readonly sqsClient: MiniSQSClient;
	private readonly hooks: Hooks;
	// biome-ignore lint/suspicious/noExplicitAny: type is unpredictable here
	private readonly messageHandler: (message: Message) => Promise<any>;
	private messagesOnFly: number = 0;
	private running: boolean = false;
	private polling: boolean = false;
	private destroyed: boolean = false;
	private readonly logger: Logger;

	constructor(options: SQSConsumerOptions) {
		if (!options.queueARN) throw new Error("queueARN is required");
		if (!options.handler || typeof options.handler !== "function")
			throw new Error("handler is required and must be a function");
		this.logger = options.logger ?? console;
		this.hooks = new Hooks(this.logger);
		this.queueARN = options.queueARN;
		const region = this.queueARN.split(":").reverse()[2];
		this.clientOptions = {
			destroySigner: options.clientOptions?.destroySigner ?? true,
		};
		this.handlerOptions = {
			deleteMessage: options.handlerOptions?.deleteMessage ?? true,
			extendVisibilityTimeout:
				options.handlerOptions?.extendVisibilityTimeout ?? true,
			executionTimeout: options.handlerOptions?.executionTimeout ?? 30_000,
			parallelExecution: options.handlerOptions?.parallelExecution ?? true,
		};
		this.consumerOptions = {
			visibilityTimeout: options.consumerOptions?.visibilityTimeout ?? 30,
			waitTimeSeconds: options.consumerOptions?.waitTimeSeconds ?? 20,
			itemsPerRequest: options.consumerOptions?.itemsPerRequest ?? 10,
			messageAttributeNames:
				options.consumerOptions?.messageAttributeNames ?? [],
			attributeNames: options.consumerOptions?.attributeNames ?? [],
		};
		this.sqsClient =
			options.clientOptions?.sqsClient ??
			new MiniSQSClient(
				region,
				options.clientOptions?.endpoint,
				options.clientOptions?.undiciOptions,
				options.clientOptions?.signer,
			);
		if (options.hooks) {
			for (const [key, value] of Object.entries(options.hooks)) {
				if (typeof value !== "function")
					throw new Error(`${key} must be a function`);
				// biome-ignore lint/suspicious/noExplicitAny: dynamic registration loses type correlation
				this.addHook(key as HookName, value as any);
			}
		}
		this.messageHandler = options.handler;
		if (options.autostart !== false) {
			void this.start();
		}
	}

	private async runOnMessageHook(message: Message) {
		try {
			await this.hooks.runHook("onMessage", message);
			const result = await this.runHandler(this.messageHandler, message);
			await this.hooks.runHook("onSuccess", message);
			return {
				message,
				result,
			};
		} catch (e) {
			await this.hooks.runHook("onError", "onMessage", message, e as Error);
			return {
				message,
				error: e,
			};
		}
	}

	private async runHandler(
		handler: typeof this.messageHandler,
		message: Message,
	) {
		let timeoutId: ReturnType<typeof setTimeout> | null = null;
		try {
			let handlerResult: unknown;
			if (this.handlerOptions.executionTimeout) {
				handlerResult = await Unpromise.race([
					handler(message),
					new Promise((_resolve, reject) => {
						timeoutId = setTimeout(() => {
							reject(new TimeoutError("Handler execution timed out"));
						}, this.handlerOptions.executionTimeout);
					}),
				]);
			} else {
				handlerResult = await handler(message);
			}
			await this.hooks.runHook("onHandlerSuccess", message);
			return handlerResult;
		} catch (error) {
			if (error instanceof TimeoutError) {
				await this.hooks.runHook("onHandlerTimeout", message);
			} else {
				await this.hooks.runHook("onHandlerError", message, error as Error);
			}
			throw error;
		} /* c8 ignore next 2 */ finally {
			if (timeoutId) clearTimeout(timeoutId);
		}
	}

	private haExtendVisibilityTimeout(
		messages: Message[],
		visibilityTimeout: number,
	) {
		if (this.handlerOptions.extendVisibilityTimeout !== false) {
			const processingMessages = messages.map(
				// biome-ignore lint/style/noNonNullAssertion: ReceiptHandle must be present here
				(message) => message.ReceiptHandle!,
			);
			return setInterval(
				async () => {
					try {
						await this.sqsClient.changeMessageVisibilityBatch(
							this.queueARN,
							processingMessages,
							visibilityTimeout,
						);
					} /* c8 ignore next 3 */ catch (e) {
						await this.hooks.runHook("onSQSError", e as Error);
					}
				},
				visibilityTimeout * 1000 - 5,
			);
		}
		return null;
	}

	private async deleteMessages(
		messagesResults: Awaited<ReturnType<typeof this.runOnMessageHook>>[],
	) {
		const candidatesToDelete: string[] = [];
		const candidateToRelease: string[] = [];
		for (const result of messagesResults) {
			if (result.error) {
				// biome-ignore lint/style/noNonNullAssertion: ReceiptHandle must be present here
				candidateToRelease.push(result.message.ReceiptHandle!);
			} else if (this.handlerOptions.deleteMessage !== false) {
				// biome-ignore lint/style/noNonNullAssertion: ReceiptHandle must be present here
				candidatesToDelete.push(result.message.ReceiptHandle!);
			}
		}
		if (candidatesToDelete.length) {
			await this.sqsClient.deleteMessageBatch(
				this.queueARN,
				candidatesToDelete,
			);
		}
		if (candidateToRelease.length) {
			await this.sqsClient.changeMessageVisibilityBatch(
				this.queueARN,
				candidateToRelease,
				0,
			);
		}
	}

	private async pollMessages() {
		let consecutiveErrors = 0;
		while (this.running) {
			try {
				this.polling = true;
				/* c8 ignore next 1 */
				const visibilityTimeout = this.consumerOptions.visibilityTimeout ?? 30;
				const messagesResult = await this.sqsClient.receiveMessage(
					this.queueARN,
					{
						WaitTimeSeconds: this.consumerOptions.waitTimeSeconds,
						MaxNumberOfMessages: this.consumerOptions.itemsPerRequest,
						VisibilityTimeout: visibilityTimeout,
						MessageAttributeNames: this.consumerOptions.messageAttributeNames,
						AttributeNames: this.consumerOptions.attributeNames,
					},
				);
				const messages = await this.hooks.runHook(
					"onPoll",
					/* c8 ignore next 1 */
					messagesResult.Messages ?? [],
				);
				this.messagesOnFly += messages.length;
				if (messages.length) {
					const haTimeout = this.haExtendVisibilityTimeout(
						messages,
						visibilityTimeout,
					);
					try {
						if (this.handlerOptions.parallelExecution !== false) {
							try {
								const results = await pMap(
									messages,
									async (message) => {
										return await this.runOnMessageHook(message);
									},
									{
										concurrency: 10,
										stopOnError: false,
									},
								);
								await this.deleteMessages(results);
							} finally {
								this.messagesOnFly -= messages.length;
							}
						} else {
							const handlingMessages = [...messages];
							for (let i = 0; i < handlingMessages.length; i++) {
								try {
									const result = await this.runOnMessageHook(
										handlingMessages[i],
									);
									await this.deleteMessages([result]);
								} finally {
									this.messagesOnFly -= 1;
								}
							}
						}
					} finally {
						if (haTimeout) clearInterval(haTimeout);
					}
				}
				consecutiveErrors = 0;
			} catch (e) {
				await this.hooks.runHook("onSQSError", e as Error);
				await setTimeoutAsync(
					Math.min(1000 * 2 ** consecutiveErrors++, 30_000),
				);
			}
			this.polling = false;
		}
	}

	// eslint-disable-next-line @typescript-eslint/require-await
	public async start() {
		try {
			if (this.running) throw new Error("Consumer is already running");
			if (this.destroyed) throw new Error("Consumer is destroyed");
			this.running = true;
			void this.pollMessages();
		} finally {
			await this.hooks.runHook("onStart", this);
		}
	}

	public async stop(destroy = false) {
		try {
			if (!this.running) throw new Error("Consumer is not running");
			this.running = false;
			while (this.messagesOnFly > 0 || this.polling) {
				await setTimeoutAsync(500);
			}
			if (destroy) {
				await this.sqsClient.destroy(this.clientOptions.destroySigner);
				this.destroyed = true;
			}
		} finally {
			await this.hooks.runHook("onStop", this);
		}
	}

	public get isRunning() {
		return this.running;
	}
	public addHook<H extends HookName>(hookName: H, value: HookCallback<H>) {
		this.hooks.addHook(hookName, value);
		return this;
	}
}
