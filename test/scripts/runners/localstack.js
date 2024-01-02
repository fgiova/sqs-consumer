const { spawn } = require("child_process");
const { SQS } = require("@aws-sdk/client-sqs");
const { GenericContainer, Wait, Network }  = require("testcontainers");


const startLocalStack = async () => {
    const localStack = await new GenericContainer("localstack/localstack:latest")
        .withExposedPorts(4566)
        .withEnvironment({
            SERVICES: "sqs,sns",
            DEBUG: "1",
            DOCKER_HOST: "unix:///var/run/docker.sock",
            NODE_TLS_REJECT_UNAUTHORIZED: "0",
            HOSTNAME: "localhost",
            AWS_DEFAULT_REGION: "eu-central-1",
        })
        .withBindMounts([{
            source: "/var/run/docker.sock",
            target: "/var/run/docker.sock"
        }])
        .withWaitStrategy(Wait.forLogMessage("Running on https://0.0.0.0:4566"))
        .start();
    const port = localStack.getMappedPort(4566);
    const host = localStack.getHost();
    process.env.AWS_REGION="eu-central-1"
    process.env.AWS_ACCESS_KEY_ID="AWS_ACCESS_KEY_ID"
    process.env.AWS_SECRET_ACCESS_KEY="AWS_SECRET_ACCESS_KEY"
    return {
        container: localStack,
        port,
        host
    };
}

const bootstrap = async (host, port) => {
    console.log(`Bootstrap SQS`);
    const sqs = new SQS({
        endpoint: `http://${host}:${port}`
    })
    await sqs.createQueue({
        QueueName: "test-queue"
    });
    await sqs.createQueue({
        QueueName: "test-queue-errors"
    });
    await sqs.createQueue({
        QueueName: "test-queue-hooks"
    });
};

module.exports = {
    startLocalStack,
    bootstrap
}