// biome-ignore lint/suspicious/noTsIgnore: is a Test file
// @ts-ignore
import "../helpers/localtest";
import { setTimeout } from "node:timers/promises";
import { Signer } from "@fgiova/aws-signature";
import { type Message, MiniSQSClient } from "@fgiova/mini-sqs-client";
import { before, teardown, test } from "tap";
import { getAbortSignal, SQSConsumer } from "../../src/index";
// biome-ignore lint/suspicious/noTsIgnore: is a Test file
// @ts-ignore
import { sqsPurge } from "../helpers/sqsMessage";

const queueARN = "arn:aws:sqs:eu-central-1:000000000000:test-queue-context";
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

test("getAbortSignal", { only: true }, async (t) => {
	await t.test("returns undefined outside handler context", async (t) => {
		t.equal(getAbortSignal(), undefined);
	});

	await t.test("returns AbortSignal inside handler context", async (t) => {
		const messageToSend = {
			MessageBody: "Hello World!",
		};
		await client.sendMessage(queueARN, messageToSend);

		const signalState = new Promise<{
			isSignal: boolean;
			aborted: boolean;
		}>((resolve) => {
			const consumer = new SQSConsumer({
				queueARN,
				handler: async (_message: Message) => {
					const signal = getAbortSignal();
					resolve({
						isSignal: signal instanceof AbortSignal,
						aborted: signal?.aborted ?? true,
					});
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
				await sqsPurge(queueARN);
			});
		});

		const state = await signalState;
		t.equal(state.isSignal, true);
		t.equal(state.aborted, false);
	});

	await t.test("signal aborts on handler timeout", async (t) => {
		const messageToSend = {
			MessageBody: "Hello World!",
		};
		await client.sendMessage(queueARN, messageToSend);

		const abortReason = new Promise<unknown>((resolve) => {
			const consumer = new SQSConsumer({
				queueARN,
				handler: async (message: Message) => {
					const signal = getAbortSignal();
					await setTimeout(3_000);
					// biome-ignore lint/style/noNonNullAssertion: ReceiptHandle must be present here
					await client.deleteMessage(queueARN, message.ReceiptHandle!);
					resolve(signal?.reason);
					return { success: true };
				},
				handlerOptions: {
					executionTimeout: 500,
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
				await sqsPurge(queueARN);
			});
		});

		const reason = await abortReason;
		t.ok(reason instanceof Error);
		t.equal((reason as Error).name, "TimeoutError");
	});
});