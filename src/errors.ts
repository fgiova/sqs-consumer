export class TimeoutError extends Error {
	constructor(message?: string) {
		/* c8 ignore next 1 */
		super(message || "Timeout Error");
		this.name = "TimeoutError";
	}
}
