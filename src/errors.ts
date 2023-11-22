export class TimeoutError extends Error {
	constructor(message?: string) {
		super(message || "Timeout Error");
		this.name = "TimeoutError";
	}
}