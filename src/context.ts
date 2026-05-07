import { AsyncLocalStorage } from "node:async_hooks";

type HandlerContext = {
	signal: AbortSignal;
};

export const handlerContext = new AsyncLocalStorage<HandlerContext>();

export function getAbortSignal(): AbortSignal | undefined {
	return handlerContext.getStore()?.signal;
}