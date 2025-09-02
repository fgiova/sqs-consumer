// @ts-expect-error
import "../helpers/localtest";
import { clearInterval } from "node:timers";
import { setTimeout } from "node:timers/promises";
import { Signer, SignerSingleton } from "@fgiova/aws-signature";
import { type Message, MiniSQSClient } from "@fgiova/mini-sqs-client";
import { teardown, test } from "tap";
import { SQSConsumer } from "../../src/index";
// @ts-expect-error
import { sqsPurge } from "../helpers/sqsMessage";

const queueARN = "arn:aws:sqs:eu-central-1:000000000000:test-queue";

teardown(async () => {
	await SignerSingleton.getSigner().destroy();
});

async function teardownConsumer(consumer: SQSConsumer) {
	await consumer.stop();
	await sqsPurge(queueARN);
}

test("sqs-consumer class", { only: true }, async (t) => {
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
	await t.test("simple get message from queue", async (t) => {
		const { client } = t.context;

		// biome-ignore lint/suspicious/noExplicitAny: type is not important here
		let handler: (message: Message) => Promise<any>;
		const messageToSend = {
			MessageBody: "Hello World!",
		};
		const message = new Promise((resolve) => {
			handler = async (message: Message) => {
				resolve(message.Body);
				return { success: true };
			};
		});

		await client.sendMessage(queueARN, messageToSend);

		const consumer = new SQSConsumer({
			queueARN,
			// @ts-expect-error
			handler,
			autostart: false,
			clientOptions: {
				endpoint: process.env.LOCALSTACK_ENDPOINT,
			},
		});
		t.teardown(async () => {
			await teardownConsumer(consumer);
		});
		await consumer.start();
		await t.resolves(message);
		t.same(await message, messageToSend.MessageBody);
	});
	await t.test("simple get message from queue - no timeout", async (t) => {
		const { client } = t.context;

		// biome-ignore lint/suspicious/noExplicitAny: type is not important here
		let handler: (message: Message) => Promise<any>;
		const messageToSend = {
			MessageBody: "Hello World!",
		};
		const message = new Promise((resolve) => {
			handler = async (message: Message) => {
				resolve(message.Body);
				return { success: true };
			};
		});

		await client.sendMessage(queueARN, messageToSend);

		const consumer = new SQSConsumer({
			queueARN,
			// @ts-expect-error
			handler,
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
		await consumer.start();
		await t.resolves(message);
		t.same(await message, messageToSend.MessageBody);
	});
	await t.test(
		"simple get message from queue - no extended visbility",
		async (t) => {
			const { client } = t.context;

			// biome-ignore lint/suspicious/noExplicitAny: any is ok
			let handler: (message: Message) => Promise<any>;
			const messageToSend = {
				MessageBody: "Hello World!",
			};
			const message = new Promise((resolve) => {
				handler = async (message: Message) => {
					resolve(message.Body);
					return { success: true };
				};
			});

			await client.sendMessage(queueARN, messageToSend);

			const consumer = new SQSConsumer({
				queueARN,
				// @ts-expect-error
				handler,
				autostart: false,
				handlerOptions: {
					extendVisibilityTimeout: false,
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
			await consumer.start();
			await t.resolves(message);
			t.same(await message, messageToSend.MessageBody);
		},
	);

	await t.test(
		"simple get message from queue - destroy signer on shutdown",
		async (t) => {
			const { client } = t.context;

			// biome-ignore lint/suspicious/noExplicitAny: any is ok
			let handler: (message: Message) => Promise<any>;
			const messageToSend = {
				MessageBody: "Hello World!",
			};
			const message = new Promise((resolve) => {
				handler = async (message: Message) => {
					resolve(message.Body);
					return { success: true };
				};
			});

			await client.sendMessage(queueARN, messageToSend);

			const consumer = new SQSConsumer({
				queueARN,
				// @ts-expect-error
				handler,
				autostart: false,
				clientOptions: {
					endpoint: process.env.LOCALSTACK_ENDPOINT,
					signer: new Signer(),
				},
			});
			t.teardown(async () => {
				await consumer.stop(true);
				await sqsPurge(queueARN);
			});
			await consumer.start();
			await t.resolves(message);
			t.same(await message, messageToSend.MessageBody);
		},
	);

	await t.test("simple get messages from queue", async (t) => {
		const { client } = t.context;

		const messageToSend = {
			MessageBody: "Hello World!",
		};

		const messages: Message[] = [];

		await client.sendMessage(queueARN, messageToSend);
		await client.sendMessage(queueARN, messageToSend);

		const consumer = new SQSConsumer({
			queueARN,
			handler: async (message: Message) => {
				messages.push(message);
			},
			clientOptions: {
				endpoint: process.env.LOCALSTACK_ENDPOINT,
			},
			consumerOptions: {
				waitTimeSeconds: 1,
			},
		});
		t.teardown(async () => {
			await teardownConsumer(consumer);
		});
		await new Promise((resolve) => {
			const interval = setInterval(() => {
				if (messages.length === 2) {
					resolve(undefined);
					clearInterval(interval);
				}
			}, 300);
		});
		t.same(messages[0].Body, messageToSend.MessageBody);
	});
	await t.test("simple get messages from queue serial handling", async (t) => {
		const { client } = t.context;

		const messageToSend = {
			MessageBody: "Hello World!",
		};

		const messages: Message[] = [];
		await client.sendMessage(queueARN, messageToSend);
		await client.sendMessage(queueARN, messageToSend);

		const consumer = new SQSConsumer({
			queueARN,
			handler: async (message: Message) => {
				messages.push(message);
			},
			consumerOptions: {
				waitTimeSeconds: 1,
			},
			handlerOptions: {
				parallelExecution: false,
			},
			clientOptions: {
				endpoint: process.env.LOCALSTACK_ENDPOINT,
			},
		});
		t.teardown(async () => {
			await teardownConsumer(consumer);
		});
		await new Promise((resolve) => {
			const interval = setInterval(() => {
				if (messages.length === 2) {
					resolve(undefined);
					clearInterval(interval);
				}
			}, 300);
		});
		t.same(messages[0].Body, messageToSend.MessageBody);
	});

	await t.test("simple get message from queue - haTimeout", async (t) => {
		const { client } = t.context;

		// biome-ignore lint/suspicious/noExplicitAny: any is ok
		let handler: (message: Message) => Promise<any>;
		const messageToSend = {
			MessageBody: "Hello World!",
		};
		const message = new Promise((resolve) => {
			handler = async (message: Message) => {
				await setTimeout(3_000);
				resolve(message.Body);
				return { success: true };
			};
		});

		await client.sendMessage(queueARN, messageToSend);

		const consumer = new SQSConsumer({
			queueARN,
			// @ts-expect-error
			handler,
			autostart: false,
			handlerOptions: {
				executionTimeout: 30_000,
				extendVisibilityTimeout: true,
			},
			consumerOptions: {
				visibilityTimeout: 1,
				waitTimeSeconds: 1,
			},
			clientOptions: {
				endpoint: process.env.LOCALSTACK_ENDPOINT,
			},
		});
		t.teardown(async () => {
			await teardownConsumer(consumer);
		});
		await consumer.start();
		await t.resolves(message);
		t.same(await message, messageToSend.MessageBody);
	});

	await t.test("simple get message from queue after empty get", async (t) => {
		const { client } = t.context;

		// biome-ignore lint/suspicious/noExplicitAny: type is not important here
		let handler: (message: Message) => Promise<any>;
		const messageToSend = {
			MessageBody: "Hello World!",
		};
		const message = new Promise((resolve) => {
			handler = async (message: Message) => {
				resolve(message.Body);
				return { success: true };
			};
		});

		const consumer = new SQSConsumer({
			queueARN,
			// @ts-expect-error
			handler,
			autostart: false,
			clientOptions: {
				endpoint: process.env.LOCALSTACK_ENDPOINT,
			},
			consumerOptions: {
				waitTimeSeconds: 1,
			},
		});
		t.teardown(async () => {
			await teardownConsumer(consumer);
		});
		await consumer.start();
		await setTimeout(2_000);
		await client.sendMessage(queueARN, messageToSend);
		await t.resolves(message);
		t.same(await message, messageToSend.MessageBody);
	});
});
