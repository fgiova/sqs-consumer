export type HookName = "onPoll" |
	"onMessage" |
	"onHandlerSuccess" |
	"onHandlerTimeout" |
	"onHandlerError" |
	"onSuccess" |
	"onError" |
	"onSQSError";

export class Hooks {
	private hookSymbols = {
		onPoll: Symbol("poll"),
		onMessage: Symbol("message"),
		onHandlerSuccess: Symbol("handlerSuccess"),
		onHandlerTimeout: Symbol("handlerTimeout"),
		onHandlerError: Symbol("handlerError"),
		onSuccess: Symbol("success"),
		onError: Symbol("error"),
		onSQSError: Symbol("sqsError"),

	}
	private hooks: Record<symbol, Function[]>;

	constructor() {
		this.hooks = {
			[this.hookSymbols.onPoll]: [],
			[this.hookSymbols.onMessage]: [],
			[this.hookSymbols.onHandlerSuccess]: [],
			[this.hookSymbols.onHandlerTimeout]: [],
			[this.hookSymbols.onHandlerError]: [],
			[this.hookSymbols.onSuccess]: [],
			[this.hookSymbols.onError]: [],
			[this.hookSymbols.onSQSError]: [],
		};
	}
	public addHook(hook: HookName, fn: Function) {
		const hookSymbol = this.hookSymbols[hook];
		if(!hookSymbol) throw new Error(`Invalid hook ${hook}`);
		this.hooks[hookSymbol]?.push(fn);
	}

	public async runHook(hook: HookName, ...args: any[]) {
		const hookSymbol = this.hookSymbols[hook];
		if(!hookSymbol) throw new Error(`Invalid hook ${hook}`);
		for (const fn of this.hooks[hookSymbol]!) {
			await fn(...args);
		}
	}
}