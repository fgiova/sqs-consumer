import {Signer, SignerOptions} from "@fgiova/aws-signature";
import type {Pool} from "undici";
import {MiniSQSClient, Message} from "@fgiova/mini-sqs-client";
import {HookName, Hooks} from "./hooks";
import {TimeoutError} from "./errors";
import pMap from "p-map";

export class SQSConsumer {

	private readonly queueARN: string;
	private readonly handlerOptions: {
		deleteMessage?: boolean,
		extendVisibilityTimeout?: boolean,
		executionTimeout?: number,
		parallelExecution?: boolean,
	};
	private readonly clientOptions: {
		destroySigner?: boolean,
	};
	private readonly consumerOptions: {
		deleteMessage?: boolean,
		visibilityTimeout?: number,
		waitTimeSeconds?: number,
		itemsPerRequest?: number,
		messageAttributeNames?: string[],
	};
	private readonly sqsClient: MiniSQSClient;
	private readonly hooks: Hooks;
	private readonly messageHandler: (message: Message) => Promise<any>;
	private messagesOnFly: number = 0;
	private running: boolean = false;
	private destroyed: boolean = false;

	constructor(options:{
		queueARN: string,
		handler: (message: Message) => Promise<any>,
		autostart?: boolean,
		handlerOptions?: {
			deleteMessage?: boolean,
			extendVisibilityTimeout?: boolean,
			executionTimeout?: number,
			parallelExecution?: boolean,
		},
		clientOptions?: {
			sqsClient?: MiniSQSClient,
			endpoint?: string,
			undiciOptions?: Pool.Options,
			signer?: Signer | SignerOptions,
			destroySigner?: boolean,
		},
		consumerOptions?: {
			deleteMessage?: boolean,
			visibilityTimeout?: number,
			waitTimeSeconds?: number,
			itemsPerRequest?: number,
			messageAttributeNames?: string[],
		},
		hooks?: {
			onPoll?: (messages: Message[]) => Promise<Message[]>,
			onMessage?: (message: Message) => Promise<Message>,
			onHandlerSuccess?: (message: Message) => Promise<Message>,
			onHandlerTimeout?: (message: Message) => Promise<Boolean>,
			onHandlerError?: (message: Message, error: Error) => Promise<Boolean>,
			onSuccess?: (message: Message) => Promise<Boolean>,
			onError?: ( hook: HookName, message: Message, error: Error) => Promise<Boolean>,
			onSQSError?: (error: Error, message?: Message) => Promise<void>,
	}}) {

		if(!options.queueARN) throw new Error("queueARN is required");
		if(!options.handler || typeof options.handler !== "function") throw new Error("handler is required and must be a function");

		this.hooks = new Hooks();
		this.queueARN = options.queueARN;
		this.clientOptions = { destroySigner: options.clientOptions?.destroySigner ?? true };

		if (options.hooks){
			for (const [key, value] of Object.entries(options.hooks)) {
				if(typeof value !== "function") throw new Error(`${key} must be a function`);
				this.hooks.addHook(key as HookName, value);
			}
		}
		this.messageHandler = options.handler;
		if(options.autostart !== false) {
			void this.start();
		}
	}

	private async runOnMessageHook(message: Message) {
		try {
			await this.hooks.runHook("onMessage", message);
			const result = await this.runHandler(this.messageHandler, message);
			await this.hooks.runHook("onSuccess", message)
			return {
				message,
				result
			}
		}
		catch (e) {
			await this.hooks.runHook("onError", "onMessage", message, e);
			return {
				message,
				error: e
			}
		}
	}

	private async runHandler(handler: typeof this.messageHandler, message: Message) {
		try {
			let handlerResult: any;
			if(this.consumerOptions.waitTimeSeconds) {
				const response = await Promise.race([
					handler(message),
					new Promise((resolve, reject) => {
						setTimeout(() => {
							reject(new TimeoutError("Handler execution timed out"));
						}, this.handlerOptions.executionTimeout);
					})
				]);
				handlerResult = response;
			}
			else {
				handlerResult = await handler(message);
			}
			await Promise.all([
				this.hooks.runHook("onHandlerSuccess", message),
			]);
			return handlerResult;
		}
		catch (error) {
			if(error instanceof TimeoutError) {
				await this.hooks.runHook("onHandlerTimeout", message);
			}
			else {
				await this.hooks.runHook("onHandlerError", message, error);
			}
			throw error;
		}
	}

	private haExtendVisibilityTimeout(messages: Message[], visibilityTimeout: number) {
		if(this.handlerOptions.extendVisibilityTimeout !== false) {
			const processingMessages = messages.map(message => message.ReceiptHandle);
			return setTimeout(async () => {
				try {
					await this.sqsClient.changeMessageVisibilityBatch(this.queueARN, processingMessages, visibilityTimeout);
				}
				catch (e) {
					await this.hooks.runHook("onSQSError", e);
				}
			}, (visibilityTimeout - 5) * 1000);
		}
	}

	private async deleteMessages(messagesResults: Awaited<ReturnType<typeof this.runOnMessageHook>>[]) {
		if(this.handlerOptions.deleteMessage !== false) {
			const candidatesToDelete: string[] = [];
			for (const result of messagesResults) {
				if(result.result) {
					candidatesToDelete.push(result.message.ReceiptHandle);
				}
				await this.sqsClient.deleteMessageBatch(this.queueARN, candidatesToDelete);
			}
		}
	}

	private async pollMessages() {
		if(!this.running) return;
		try {
			const visibilityTimeout = this.consumerOptions.visibilityTimeout || 30;
			const messagesResult = await this.sqsClient.receiveMessage(this.queueARN, {
				WaitTimeSeconds: this.consumerOptions.waitTimeSeconds,
				MaxNumberOfMessages: this.consumerOptions.itemsPerRequest,
				VisibilityTimeout: visibilityTimeout,
				MessageAttributeNames: this.consumerOptions.messageAttributeNames,
			});
			const messages = messagesResult.Messages ?? [];
			const totalMessages = messages.length;
			this.messagesOnFly += totalMessages;
			await this.hooks.runHook("onPoll", messages);
			if(messages.length){
				const haTimeout = this.haExtendVisibilityTimeout(messages, visibilityTimeout);
				this.messagesOnFly += (messages.length - totalMessages);
				if(this.handlerOptions.parallelExecution !== false) {
					const results = await pMap(messages, async (message) => {
						return await this.runOnMessageHook(message);
					}, {
						concurrency: 10,
						stopOnError: false,
					});
					await this.deleteMessages(results);
					this.messagesOnFly -= messages.length;
				}
				else {
					for (let i = 0; i < messages.length; i++) {
						const result = await this.runOnMessageHook(messages[i]);
						await this.deleteMessages([result]);
						messages.splice(i, 1);
						this.messagesOnFly -= 1;
					}
				}
				if(haTimeout) clearTimeout(haTimeout);
			}
			else {
				this.messagesOnFly -= totalMessages;
			}
		}
		catch (e) {
			await this.hooks.runHook("onSQSError", e);
		}

		await this.pollMessages()
	}

	public async start() {
		if(this.running) throw new Error("Consumer is already running");
		if(this.destroyed) throw new Error("Consumer is destroyed");
		this.running = true;
		void this.pollMessages();
	}

	public async stop(destroy=false) {
		if(!this.running) throw new Error("Consumer is not running");
		this.running = false;
		while (this.messagesOnFly > 0) {
			await new Promise(resolve => setTimeout(resolve, 500));
		}
		if(destroy) {
			await this.sqsClient.destroy(this.clientOptions.destroySigner);
			this.destroyed = true;
		}
	}
}