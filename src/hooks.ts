import {Logger} from "./logger";

export type HookName = "onPoll" |
	"onMessage" |
	"onHandlerSuccess" |
	"onHandlerTimeout" |
	"onHandlerError" |
	"onSuccess" |
	"onError" |
	"onSQSError";

export class Hooks {
	private readonly hookSymbols = {
		onPoll: {
			S:Symbol("poll"),
			throwable: true
		},
		onMessage: {
			S:Symbol("message"),
			throwable: true
		},
		onHandlerSuccess: {
			S:Symbol("handlerSuccess"),
			throwable: false
		},
		onHandlerTimeout: {
			S:Symbol("handlerTimeout"),
			throwable: false
		},
		onHandlerError: {
			S:Symbol("handlerError"),
			throwable: false
		},
		onSuccess: {
			S:Symbol("success"),
			throwable: false
		},
		onError: {
			S:Symbol("error"),
			throwable: false
		},
		onSQSError: {
			S:Symbol("sqsError"),
			throwable: false
		},

	}
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
	public addHook(hook: HookName, fn: Function) {
		const hookSymbol = this.hookSymbols[hook];
		if(!hookSymbol) throw new Error(`Invalid hook ${hook}`);
		this.hooks[hookSymbol.S]?.push(fn);
	}

	public async runHook(hook: HookName, ...args: any[]) {
		const hookSymbol = this.hookSymbols[hook];
		try {
			if(!hookSymbol) throw new Error(`Invalid hook ${hook}`);
			for (const fn of this.hooks[hookSymbol.S]!) {
				await fn(...args);
			}
		}
		catch (error) {
			error.message = `Error running hook ${hook}: ${error.message}`;
			if(hookSymbol.throwable!==false) throw error;
			this.logger.error(error);
		}

	}
}