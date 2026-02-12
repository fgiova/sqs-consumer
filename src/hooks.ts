/** biome-ignore-all lint/complexity/noBannedTypes: Function required as generic */
import type { Message } from "@fgiova/mini-sqs-client";
import type { Logger } from "./logger";

export type HookName =
	| "onStart"
	| "onStop"
	| "onPoll"
	| "onMessage"
	| "onHandlerSuccess"
	| "onHandlerTimeout"
	| "onHandlerError"
	| "onSuccess"
	| "onError"
	| "onSQSError";

export type HookSignatureMap = {
	onStart: { args: [sqsConsumer: unknown]; return: undefined };
	onStop: { args: [sqsConsumer: unknown]; return: undefined };
	onPoll: { args: [messages: Message[]]; return: Message[] };
	onMessage: { args: [message: Message]; return: Message };
	onHandlerSuccess: { args: [message: Message]; return: Message };
	onHandlerTimeout: { args: [message: Message]; return: boolean };
	onHandlerError: { args: [message: Message, error: Error]; return: boolean };
	onSuccess: { args: [message: Message]; return: boolean };
	onError: {
		args: [hook: HookName, message: Message, error: Error];
		return: boolean;
	};
	onSQSError: { args: [error: Error, message?: Message]; return: undefined };
};

export type HookCallback<H extends HookName> = (
	...args: HookSignatureMap[H]["args"]
) =>
	| HookSignatureMap[H]["return"]
	| Promise<HookSignatureMap[H]["return"]>
	| void
	| Promise<void>
	| undefined;

type HookSymbolData = {
	S: symbol;
	throwable: boolean;
	type: "boolean-return" | "message-return" | "void";
};

export class Hooks {
	private readonly hookSymbols: Record<HookName, HookSymbolData> = {
		onStart: {
			S: Symbol("start"),
			throwable: false,
			type: "void",
		},
		onStop: {
			S: Symbol("stop"),
			throwable: false,
			type: "void",
		},
		onPoll: {
			S: Symbol("poll"),
			throwable: true,
			type: "message-return",
		},
		onMessage: {
			S: Symbol("message"),
			throwable: true,
			type: "message-return",
		},
		onHandlerSuccess: {
			S: Symbol("handlerSuccess"),
			throwable: false,
			type: "message-return",
		},
		onHandlerTimeout: {
			S: Symbol("handlerTimeout"),
			throwable: false,
			type: "boolean-return",
		},
		onHandlerError: {
			S: Symbol("handlerError"),
			throwable: false,
			type: "boolean-return",
		},
		onSuccess: {
			S: Symbol("success"),
			throwable: false,
			type: "boolean-return",
		},
		onError: {
			S: Symbol("error"),
			throwable: false,
			type: "boolean-return",
		},
		onSQSError: {
			S: Symbol("sqsError"),
			throwable: false,
			type: "void",
		},
	};
	// eslint-disable-next-line @typescript-eslint/ban-types
	private readonly hooks: Record<symbol, Function[]>;
	private readonly logger: Logger;

	constructor(logger: Logger = console) {
		this.logger = logger;
		this.hooks = {
			[this.hookSymbols.onStart.S]: [],
			[this.hookSymbols.onStop.S]: [],
			[this.hookSymbols.onPoll.S]: [],
			[this.hookSymbols.onMessage.S]: [],
			[this.hookSymbols.onHandlerSuccess.S]: [],
			[this.hookSymbols.onHandlerTimeout.S]: [],
			[this.hookSymbols.onHandlerError.S]: [],
			[this.hookSymbols.onSuccess.S]: [],
			[this.hookSymbols.onError.S]: [],
			[this.hookSymbols.onSQSError.S]: [],
		};
	}
	public addHook<H extends HookName>(hook: H, fn: HookCallback<H>) {
		const hookSymbol = this.hookSymbols[hook];
		if (!hookSymbol) throw new Error(`Invalid hook ${hook}`);
		this.hooks[hookSymbol.S]?.push(fn);
	}

	public async runHook<H extends HookName>(
		hook: H,
		...args: HookSignatureMap[H]["args"]
	): Promise<HookSignatureMap[H]["return"]> {
		const hookSymbol = this.hookSymbols[hook];
		// biome-ignore lint/suspicious/noExplicitAny: internal cast for generic dispatch
		const hookArgs = args as any[];
		try {
			if (!hookSymbol) throw new Error(`Invalid hook ${hook}`);
			switch (hookSymbol.type) {
				case "boolean-return":
					return (await this.runHookWithBooleanReturn(
						hookSymbol,
						...hookArgs,
					)) as HookSignatureMap[H]["return"];
				case "message-return": {
					const [message, ...someArgs] = hookArgs;
					return (await this.runHookWithMessageReturn(
						hookSymbol,
						message,
						...someArgs,
					)) as HookSignatureMap[H]["return"];
				}
				case "void":
					return (await this.runHookWithVoidReturn(
						hookSymbol,
						...hookArgs,
					)) as HookSignatureMap[H]["return"];
			}

			// biome-ignore lint/suspicious/noExplicitAny: error type is not important
		} catch (originalError: any) {
			const newError = new Error(
				/* c8 ignore next */
				`Error running hook ${hook}: ${originalError?.message ?? originalError}`,
			);
			newError.cause = originalError;
			if (hookSymbol.throwable !== false) throw newError;
			this.logger.error(newError);
		}
		// biome-ignore lint/suspicious/noExplicitAny: fallthrough for non-throwable error paths
		return undefined as any;
	}

	private async runHookWithVoidReturn(
		hookSymbol: HookSymbolData,
		// biome-ignore lint/suspicious/noExplicitAny: args can be anything
		...args: any[]
	) {
		for (const fn of this.hooks[hookSymbol.S]) {
			await fn(...args);
		}
		return;
	}

	private async runHookWithMessageReturn(
		hookSymbol: HookSymbolData,
		message: Message | Message[],
		// biome-ignore lint/suspicious/noExplicitAny: args can be anything
		...args: any[]
	) {
		for (const fn of this.hooks[hookSymbol.S]) {
			const returnMessage = await fn(message, ...args);

			if (returnMessage) {
				message = returnMessage;
			}
		}
		return message;
	}

	private async runHookWithBooleanReturn(
		hookSymbol: HookSymbolData,
		// biome-ignore lint/suspicious/noExplicitAny: args can be anything
		...args: any[]
	) {
		for (const fn of this.hooks[hookSymbol.S]) {
			const continueLoop = await fn(...args);
			if (continueLoop === false) {
				return false;
			}
		}
		return true;
	}
}
