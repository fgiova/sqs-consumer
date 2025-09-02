import { SQS } from "@aws-sdk/client-sqs";

const sqsPurge = async (queueARN: string) => {
	const sqs = new SQS({
		apiVersion: "2012-11-05",
		endpoint: process.env.LOCALSTACK_ENDPOINT,
	});
	const [queueName, accountId] = queueARN.split(":").reverse();
	try {
		await sqs.purgeQueue({
			QueueUrl: `${process.env.LOCALSTACK_ENDPOINT}/${accountId}/${queueName}`,
		});
	} catch (e) {
		console.error(e);
	}
};

export { sqsPurge };
