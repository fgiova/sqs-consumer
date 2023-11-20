import {Signer, SignerOptions} from "@fgiova/aws-signature";
import type {Pool} from "undici";
import {MiniSQSClient, Message} from "@fgiova/mini-sqs-client";
import {HookName, Hooks} from "./hooks";

export class SQSConsumer {

	private readonly queueARN: string;
	private readonly handlerOptions: {
		deleteMessage?: boolean,
		extendVisibilityTimeout?: boolean,
		executionTimeout?: number,
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

	constructor(options:{
		queueARN: string,
		handler: (message: Message) => Promise<void>,
		handlerOptions?: {
			deleteMessage?: boolean,
			extendVisibilityTimeout?: boolean,
			executionTimeout?: number,
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
		this.hooks.addHook("onMessage", options.handler);

	}

}