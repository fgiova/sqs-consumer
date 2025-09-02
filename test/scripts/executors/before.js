const { startLocalStack, bootstrap } = require("../runners/localstack");
const { writeFile } = require("node:fs/promises");
const { getReaper } = require("testcontainers/build/reaper/reaper");
const {
	getContainerRuntimeClient,
} = require("testcontainers/build/container-runtime/clients/client");

const startReaper = async () => {
	const containerRuntimeClient = await getContainerRuntimeClient();
	await getReaper(containerRuntimeClient);
	const runningContainers = await containerRuntimeClient.container.list();
	const reaper = runningContainers.find(
		(container) => container.Labels["org.testcontainers.ryuk"] === "true",
	);
	const reaperNetwork = reaper.Ports.find((port) => port.PrivatePort === 8080);
	const reaperPort = reaperNetwork.PublicPort;
	const reaperIp = reaperNetwork.IP;
	const reaperSessionId = reaper.Labels["org.testcontainers.session-id"];
	return {
		REAPER: `${reaperIp}:${reaperPort}`,
		REAPER_SESSION: reaperSessionId,
	};
};

const before = async () => {
	if (!process.env.TEST_LOCAL) {
		console.log("Start Reaper");
		const reaperEnv = await startReaper();
		console.log("Start LocalStack");
		const {
			// biome-ignore lint/correctness/noUnusedVariables: leave for clarity
			container: localStackContainer,
			port: localStackPort,
			host: localStackHost,
		} = await startLocalStack();
		process.env.LOCALSTACK_ENDPOINT = `http://${localStackHost}:${localStackPort}`;
		await writeFile(
			"test-env.json",
			JSON.stringify({
				...reaperEnv,
				LOCALSTACK_ENDPOINT: process.env.LOCALSTACK_ENDPOINT,
				MODE: "local",
			}),
		);
		await bootstrap(localStackHost, localStackPort);
	}
};

module.exports = before();
