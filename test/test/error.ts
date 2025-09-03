// biome-ignore lint/suspicious/noTsIgnore: is a Test file
// @ts-ignore
import "../helpers/localtest";
import { setTimeout } from "node:timers/promises";
import { Signer } from "@fgiova/aws-signature";
import { type Message, MiniSQSClient } from "@fgiova/mini-sqs-client";
import { before, teardown, test } from "tap";
import { SQSConsumer } from "../../src/index";

const queueARN = "arn:aws:sqs:eu-central-1:000000000000:test-queue-errors";
let signer: Signer;
let client: MiniSQSClient;
before(() => {
	signer = new Signer();
	client = new MiniSQSClient(
		"eu-central-1",
		process.env.LOCALSTACK_ENDPOINT,
		undefined,
		signer,
	);
});
teardown(async () => {
	await signer.destroy();
});

test("sqs-consumer class Errors", { only: true }, async (t) => {
	await t.test("Handler Time Out Error on constructor", async (t) => {
		const messageToSend = {
			MessageBody: "Hello World!",
		};

		await client.sendMessage(queueARN, messageToSend);
		let onHandlerTimeout: (message: Message) => Promise<boolean>;
		const timeoutErrorMessage = new Promise<Message>((resolve, _reject) => {
			onHandlerTimeout = async (message: Message) => {
				// biome-ignore lint/style/noNonNullAssertion: ReceiptHandle must be present here
				await client.deleteMessage(queueARN, message.ReceiptHandle!);
				resolve(message);
				return true;
			};
		});

		const consumer = new SQSConsumer({
			queueARN,
			handler: async () => {
				await setTimeout(5_000);
				return { success: true };
			},
			handlerOptions: {
				executionTimeout: 1000,
			},
			clientOptions: {
				endpoint: process.env.LOCALSTACK_ENDPOINT,
				signer,
			},
			hooks: {
				// @ts-expect-error
				onHandlerTimeout,
			},
		});

		t.teardown(async () => {
			await consumer.stop();
		});
		await t.resolves(timeoutErrorMessage);
		t.same((await timeoutErrorMessage).Body, messageToSend.MessageBody);
	});
	await t.test("Add Handler Time Out Error", async (t) => {
		const messageToSend = {
			MessageBody: "Hello World!",
		};

		await client.sendMessage(queueARN, messageToSend);

		const consumer = new SQSConsumer({
			queueARN,
			handler: async () => {
				await setTimeout(5_000);
				return { success: true };
			},
			handlerOptions: {
				executionTimeout: 1000,
			},
			clientOptions: {
				endpoint: process.env.LOCALSTACK_ENDPOINT,
				signer,
			},
		});
		const timeoutErrorMessage = new Promise<Message>((resolve, _reject) => {
			consumer.addHook("onHandlerTimeout", async (message: Message) => {
				// biome-ignore lint/style/noNonNullAssertion: ReceiptHandle must be present here
				await client.deleteMessage(queueARN, message.ReceiptHandle!);
				resolve(message);
				return true;
			});
		});
		t.teardown(async () => {
			await consumer.stop();
		});
		await t.resolves(timeoutErrorMessage);
		t.same((await timeoutErrorMessage).Body, messageToSend.MessageBody);
	});

	await t.test("Add Handler Error", async (t) => {
		const messageToSend = {
			MessageBody: "Hello World!",
		};

		await client.sendMessage(queueARN, messageToSend);

		const consumer = new SQSConsumer({
			queueARN,
			handler: async () => {
				throw new Error("test");
			},
			handlerOptions: {
				executionTimeout: 1000,
			},
			clientOptions: {
				endpoint: process.env.LOCALSTACK_ENDPOINT,
				signer,
			},
		});
		const errorMessage = new Promise<Message>((resolve, _reject) => {
			consumer.addHook("onHandlerError", async (message: Message) => {
				// biome-ignore lint/style/noNonNullAssertion: ReceiptHandle must be present here
				await client.deleteMessage(queueARN, message.ReceiptHandle!);
				resolve(message);
				return true;
			});
		});
		t.teardown(async () => {
			await consumer.stop();
		});
		await t.resolves(errorMessage);
		t.same((await errorMessage).Body, messageToSend.MessageBody);
	});

	await t.test("SQS Error", async (t) => {
		const messageToSend = {
			MessageBody: "Hello World!",
		};

		await client.sendMessage(queueARN, messageToSend);

		const consumer = new SQSConsumer({
			queueARN,
			autostart: false,
			handler: async () => {
				return { success: true };
			},
			handlerOptions: {
				executionTimeout: 1000,
			},
			clientOptions: {
				signer,
			},
		});
		const errorMessage = new Promise<string>((resolve, _reject) => {
			consumer.addHook("onSQSError", async (error: Error) => {
				try {
					resolve(JSON.parse(error.message).message);
				} catch (_e) {
					resolve(error.message);
				}

				return true;
			});
		});
		t.teardown(async () => {
			await consumer.stop();
		});
		await consumer.start();
		await t.resolves(errorMessage);
		t.same(
			await errorMessage,
			"The security token included in the request is invalid.",
		);
	});

	await t.test("Missing ARN", async (t) => {
		t.throws(() => {
			new SQSConsumer({
				// @ts-expect-error
				queueARN: undefined,
				handler: async () => {
					return true;
				},
			});
		}, "queueARN is required");
	});
	await t.test("Missing Handler", async (t) => {
		t.throws(() => {
			new SQSConsumer({
				queueARN,
				// @ts-expect-error
				handler: undefined,
			});
		}, "handler is required and must be a function");
	});
	await t.test("Handler not a function", async (t) => {
		t.throws(() => {
			new SQSConsumer({
				queueARN,
				// biome-ignore lint/suspicious/noExplicitAny: type is not important here
				handler: "foo" as any,
			});
		}, "handler is required and must be a function");
	});
	await t.test("Hook is not a function", async (t) => {
		t.throws(() => {
			new SQSConsumer({
				queueARN,
				handler: async () => {
					return true;
				},
				hooks: {
					// biome-ignore lint/suspicious/noExplicitAny: type is not important here
					onMessage: "foo" as any,
				},
			});
		}, "onMessage must be a function");
	});

	await t.test("Not start a started consumer", async (t) => {
		const consumer = new SQSConsumer({
			queueARN,
			handler: async () => {
				return { success: true };
			},
			clientOptions: {
				endpoint: process.env.LOCALSTACK_ENDPOINT,
				signer,
			},
			consumerOptions: {
				waitTimeSeconds: 1,
			},
		});

		t.teardown(async () => {
			await consumer.stop();
		});
		await t.rejects(consumer.start(), "Consumer is already running");
	});
	await t.test("Not start a destroyed consumer", async (t) => {
		const consumer = new SQSConsumer({
			queueARN,
			handler: async () => {
				return { success: true };
			},
			clientOptions: {
				endpoint: process.env.LOCALSTACK_ENDPOINT,
				signer: new Signer(),
			},
			consumerOptions: {
				waitTimeSeconds: 1,
			},
		});

		await consumer.stop(true);
		await t.rejects(consumer.start(), "Consumer is destroyed");
	});
	await t.test("Not stop a not running consumer", async (t) => {
		const consumer = new SQSConsumer({
			queueARN,
			autostart: false,
			handler: async () => {
				return { success: true };
			},
			clientOptions: {
				endpoint: process.env.LOCALSTACK_ENDPOINT,
				signer,
			},
			consumerOptions: {
				waitTimeSeconds: 1,
			},
		});
		await t.rejects(consumer.stop(), "Consumer is not running");
	});
});
