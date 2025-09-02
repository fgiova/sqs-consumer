/**
 * Represents a generic logger that could be a simple console, pino etc.
 */
/** biome-ignore-all lint/suspicious/noExplicitAny: leave message logger as any */
export interface Logger {
	trace(message?: any, ...optionalParams: any[]): void;
	debug(message?: any, ...optionalParams: any[]): void;
	info(message?: any, ...optionalParams: any[]): void;
	warn(message?: any, ...optionalParams: any[]): void;
	error(message?: any, ...optionalParams: any[]): void;
	[x: string]: any;
}
