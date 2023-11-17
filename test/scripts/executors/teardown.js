const { unlink } = require("fs/promises");
const teardown = async () => {
    if (!process.env.TEST_LOCAL) {
        await unlink("test-env.json");
    }
}

module.exports = teardown();