// @ts-expect-error
import "../helpers/localtest";
import { setTimeout } from "node:timers/promises";
import { SignerSingleton } from "@fgiova/aws-signature";
import { type Message, MiniSQSClient } from "@fgiova/mini-sqs-client";
import { teardown, test } from "tap";
import { SQSConsumer } from "../../src";
import type { HookName } from "../../src/hooks";
// @ts-expect-error
import { sqsPurge } from "../helpers/sqsMessage";

const queueARN = "arn:aws:sqs:eu-central-1:000000000000:test-queue-hooks";

teardown(async () => {
	await SignerSingleton.getSigner().destroy();
});

async function teardownConsumer(consumer: SQSConsumer) {
	await consumer.stop();
	await sqsPurge(queueARN);
}

test("sqs-consumer hooks", { only: true }, async (t) => {
	t.beforeEach(async (t) => {
		const client = new MiniSQSClient(
			"eu-central-1",
			process.env.LOCALSTACK_ENDPOINT,
			undefined,
		);
		t.context = {
			client,
		};
	});
	t.afterEach(async (t) => {
		await t.context.client.destroy(false);
	});

	t.test("onPoll hook", async (t) => {
		const { client } = t.context;

		const messageToSend = {
			MessageBody: "Hello World!",
		};

		const messageSent = await client.sendMessage(queueARN, messageToSend);

		const consumer = new SQSConsumer({
			queueARN,
			handler: async () => {
				return { success: true };
			},
			autostart: false,
			handlerOptions: {
				executionTimeout: 0,
			},
			consumerOptions: {
				waitTimeSeconds: 1,
			},
			clientOptions: {
				endpoint: process.env.LOCALSTACK_ENDPOINT,
			},
		});
		t.teardown(async () => {
			await teardownConsumer(consumer);
		});
		const messagesPromise = new Promise<Message[]>((resolve) => {
			consumer.addHook("onPoll", async (messages: Message[]) => {
				resolve(messages);
				return messages;
			});
		});
		await consumer.start();
		await t.resolves(messagesPromise);
		const messages = await messagesPromise;
		t.same(messages[0].Body, messageToSend.MessageBody);
		t.same(messages[0].MD5OfBody, messageSent.MD5OfMessageBody);
		t.equal(messages.length, 1);
	});

	t.test("onMessage hook", async (t) => {
		const { client } = t.context;

		const messageToSend = {
			MessageBody: "Hello World!",
		};

		const messageSent = await client.sendMessage(queueARN, messageToSend);

		const consumer = new SQSConsumer({
			queueARN,
			handler: async () => {
				return { success: true };
			},
			autostart: false,
			handlerOptions: {
				executionTimeout: 0,
			},
			consumerOptions: {
				waitTimeSeconds: 1,
			},
			clientOptions: {
				endpoint: process.env.LOCALSTACK_ENDPOINT,
			},
		});
		t.teardown(async () => {
			await teardownConsumer(consumer);
		});
		const messagePromise = new Promise<Message>((resolve) => {
			consumer.addHook("onMessage", async (message: Message) => {
				resolve(message);
				return message;
			});
		});
		await consumer.start();
		await t.resolves(messagePromise);
		const message = await messagePromise;
		t.same(message.Body, messageToSend.MessageBody);
		t.same(message.MD5OfBody, messageSent.MD5OfMessageBody);
	});

	t.test("onHandlerSuccess hook", async (t) => {
		const { client } = t.context;

		const messageToSend = {
			MessageBody: "Hello World!",
		};

		const messageSent = await client.sendMessage(queueARN, messageToSend);

		const consumer = new SQSConsumer({
			queueARN,
			handler: async () => {
				return { success: true };
			},
			autostart: false,
			handlerOptions: {
				executionTimeout: 0,
			},
			consumerOptions: {
				waitTimeSeconds: 1,
			},
			clientOptions: {
				endpoint: process.env.LOCALSTACK_ENDPOINT,
			},
		});
		t.teardown(async () => {
			await teardownConsumer(consumer);
		});
		const messagePromise = new Promise<Message>((resolve) => {
			consumer.addHook("onHandlerSuccess", async (message: Message) => {
				resolve(message);
				return message;
			});
		});
		await consumer.start();
		await t.resolves(messagePromise);
		const message = await messagePromise;
		t.same(message.Body, messageToSend.MessageBody);
		t.same(message.MD5OfBody, messageSent.MD5OfMessageBody);
	});

	t.test("onHandlerTimeout hook", async (t) => {
		const { client } = t.context;

		const messageToSend = {
			MessageBody: "Hello World!",
		};

		const messageSent = await client.sendMessage(queueARN, messageToSend);

		const consumer = new SQSConsumer({
			queueARN,
			handler: async () => {
				await setTimeout(2_000);
				return { success: true };
			},
			autostart: false,
			handlerOptions: {
				executionTimeout: 1_000,
			},
			consumerOptions: {
				waitTimeSeconds: 1,
			},
			clientOptions: {
				endpoint: process.env.LOCALSTACK_ENDPOINT,
			},
		});
		t.teardown(async () => {
			await teardownConsumer(consumer);
		});
		const messagePromise = new Promise<Message>((resolve) => {
			consumer.addHook("onHandlerTimeout", async (message: Message) => {
				resolve(message);
				return message;
			});
		});
		await consumer.start();
		await t.resolves(messagePromise);
		const message = await messagePromise;
		t.same(message.Body, messageToSend.MessageBody);
		t.same(message.MD5OfBody, messageSent.MD5OfMessageBody);
	});

	t.test("onHandlerError hook", async (t) => {
		const { client } = t.context;

		const messageToSend = {
			MessageBody: "Hello World!",
		};

		const messageSent = await client.sendMessage(queueARN, messageToSend);

		const consumer = new SQSConsumer({
			queueARN,
			handler: async () => {
				throw new Error("test");
			},
			autostart: false,
			handlerOptions: {
				executionTimeout: 0,
			},
			consumerOptions: {
				waitTimeSeconds: 1,
			},
			clientOptions: {
				endpoint: process.env.LOCALSTACK_ENDPOINT,
			},
		});
		t.teardown(async () => {
			await teardownConsumer(consumer);
		});
		const messagePromise = new Promise<{ message: Message; error: Error }>(
			(resolve) => {
				consumer.addHook(
					"onHandlerError",
					async (message: Message, error: Error) => {
						resolve({
							message,
							error,
						});
						return message;
					},
				);
			},
		);
		await consumer.start();
		await t.resolves(messagePromise);
		const message = await messagePromise;
		t.same(message.message.Body, messageToSend.MessageBody);
		t.same(message.message.MD5OfBody, messageSent.MD5OfMessageBody);
		t.same(message.error.message, "test");
	});

	t.test("onError hook", async (t) => {
		const { client } = t.context;

		const messageToSend = {
			MessageBody: "Hello World!",
		};

		const messageSent = await client.sendMessage(queueARN, messageToSend);

		const consumer = new SQSConsumer({
			queueARN,
			handler: async () => {
				return { success: true };
			},
			autostart: false,
			handlerOptions: {
				executionTimeout: 0,
			},
			consumerOptions: {
				waitTimeSeconds: 1,
			},
			clientOptions: {
				endpoint: process.env.LOCALSTACK_ENDPOINT,
			},
		});
		t.teardown(async () => {
			await teardownConsumer(consumer);
		});
		consumer.addHook("onMessage", async () => {
			throw new Error("test");
		});
		const messagePromise = new Promise<{
			hookName: HookName;
			message: Message;
			error: Error;
		}>((resolve) => {
			consumer.addHook(
				"onError",
				async (hookName: HookName, message: Message, error: Error) => {
					resolve({
						hookName,
						message,
						error,
					});
					return message;
				},
			);
		});
		await consumer.start();
		await t.resolves(messagePromise);
		const message = await messagePromise;
		t.same(message.message.Body, messageToSend.MessageBody);
		t.same(message.message.MD5OfBody, messageSent.MD5OfMessageBody);
		t.same(message.error.message, "Error running hook onMessage: test");
		t.same(message.hookName, "onMessage");
	});

	t.test("onSuccess hook", async (t) => {
		const { client } = t.context;

		const messageToSend = {
			MessageBody: "Hello World!",
		};

		const messageSent = await client.sendMessage(queueARN, messageToSend);

		const consumer = new SQSConsumer({
			queueARN,
			handler: async () => {
				return { success: true };
			},
			autostart: false,
			handlerOptions: {
				executionTimeout: 0,
			},
			consumerOptions: {
				waitTimeSeconds: 1,
			},
			clientOptions: {
				endpoint: process.env.LOCALSTACK_ENDPOINT,
			},
		});
		t.teardown(async () => {
			await teardownConsumer(consumer);
		});
		const messagePromise = new Promise<Message>((resolve) => {
			consumer.addHook("onHandlerSuccess", async (message: Message) => {
				resolve(message);
				return message;
			});
		});
		await consumer.start();
		await t.resolves(messagePromise);
		const message = await messagePromise;
		t.same(message.Body, messageToSend.MessageBody);
		t.same(message.MD5OfBody, messageSent.MD5OfMessageBody);
	});
});
