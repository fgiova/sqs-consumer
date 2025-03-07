import {Logger} from "./logger";
import {Message} from "@fgiova/mini-sqs-client";

export type HookName = "onPoll" |
	"onMessage" |
	"onHandlerSuccess" |
	"onHandlerTimeout" |
	"onHandlerError" |
	"onSuccess" |
	"onError" |
	"onSQSError";

type HookSymbolData = {
	S: symbol,
	throwable: boolean
	type: "boolean-return" | "message-return" | "void"
}

export class Hooks {
	private readonly hookSymbols: Record<HookName, HookSymbolData> = {
		onPoll: {
			S:Symbol("poll"),
			throwable: true,
			type: "message-return"
		},
		onMessage: {
			S:Symbol("message"),
			throwable: true,
			type: "message-return"
		},
		onHandlerSuccess: {
			S:Symbol("handlerSuccess"),
			throwable: false,
			type: "message-return"
		},
		onHandlerTimeout: {
			S:Symbol("handlerTimeout"),
			throwable: false,
			type: "boolean-return"
		},
		onHandlerError: {
			S:Symbol("handlerError"),
			throwable: false,
			type: "boolean-return"
		},
		onSuccess: {
			S:Symbol("success"),
			throwable: false,
			type: "boolean-return"
		},
		onError: {
			S:Symbol("error"),
			throwable: false,
			type: "boolean-return"
		},
		onSQSError: {
			S:Symbol("sqsError"),
			throwable: false,
			type: "void"
		},

	};
	// eslint-disable-next-line @typescript-eslint/ban-types
	private readonly hooks: Record<symbol, Function[]>;
	private readonly logger: Logger;

	constructor(logger: Logger = console) {
		this.logger = logger;
		this.hooks = {
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
	// eslint-disable-next-line @typescript-eslint/ban-types
	public addHook(hook: HookName, fn: Function) {
		const hookSymbol = this.hookSymbols[hook];
		if(!hookSymbol) throw new Error(`Invalid hook ${hook}`);
		this.hooks[hookSymbol.S]?.push(fn);
	}

	public async runHook(hook: HookName, ...args: any[]) {
		const hookSymbol = this.hookSymbols[hook];
		try {
			if(!hookSymbol) throw new Error(`Invalid hook ${hook}`);
			switch (hookSymbol.type) {
			case "boolean-return":
				return await this.runHookWithBooleanReturn(hookSymbol, ...args);
			case "message-return":
				const [message, ...someArgs] = args;
				return await this.runHookWithMessageReturn(hookSymbol, message, ...someArgs);
			case "void":
				return await this.runHookWithVoidReturn(hookSymbol, ...args);
			}
			/* c8 ignore next 1 */
		}
		catch (error) {
			error.message = `Error running hook ${hook}: ${error.message}`;
			if(hookSymbol.throwable!==false) throw error;
			this.logger.error(error);
		}
	}

	private async runHookWithVoidReturn(hookSymbol: HookSymbolData, ...args: any[]) {
		for (const fn of this.hooks[hookSymbol.S]) {
			await fn(...args);
		}
		return;
	}

	private async runHookWithMessageReturn(hookSymbol: HookSymbolData, message: Message | Message[], ...args: any[]) {
		for (const fn of this.hooks[hookSymbol.S]) {
			message = await fn(message, ...args);
		}
		return message;
	}

	private async runHookWithBooleanReturn(hookSymbol: HookSymbolData, ...args: any[]) {
		for (const fn of this.hooks[hookSymbol.S]) {
			const continueLoop = await fn(...args);
			if(!continueLoop) {
				return false;
			}
		}
		return true;
	}
}