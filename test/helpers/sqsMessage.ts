import { SQS } from "@aws-sdk/client-sqs";

const sqsPurge = (queueUrl:string) => {
	const sqs = new SQS({apiVersion: "2012-11-05", endpoint: process.env.LOCALSTACK_ENDPOINT});
	return sqs.purgeQueue({
		QueueUrl: queueUrl
	});

}

export {
	sqsPurge
}