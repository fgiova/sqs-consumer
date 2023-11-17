import {Signer, SignerOptions} from "@fgiova/aws-signature";
import type {Pool} from "undici";
import {MiniSQSClient, Message} from "@fgiova/mini-sqs-client";

export class SQSConsumer {

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
			onMessage?: (message: Message) => Promise<Message>,
			onHandlerSuccess?: (message: Message) => Promise<Message>,
			onHandlerTimeout?: (message: Message) => Promise<Boolean>,
			onHandlerError?: (message: Message, error: Error) => Promise<Boolean>,
			onSuccess?: (message: Message) => Promise<Boolean>,
			onError?: (message: Message, error: Error) => Promise<Boolean>,
		}}) {

	}

}