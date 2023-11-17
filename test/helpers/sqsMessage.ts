import { SQS } from "@aws-sdk/client-sqs";

const sendSQS = (queueUrl:string, body: any) => {
	const params = {
		MessageBody: JSON.stringify(body),
		QueueUrl: queueUrl
	}
	const sqs = new SQS({apiVersion: "2012-11-05", endpoint: process.env.LOCALSTACK_ENDPOINT});
	return sqs.sendMessage(params);
}

const sqsPurge = (queueUrl:string) => {
	const sqs = new SQS({apiVersion: "2012-11-05", endpoint: process.env.LOCALSTACK_ENDPOINT});
	return sqs.purgeQueue({
		QueueUrl: queueUrl
	});

}

export {
	sendSQS,
	sqsPurge
}