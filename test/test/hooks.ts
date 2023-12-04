import { test } from "tap";
import {Hooks} from "../../src/hooks";
import { setTimeout } from "timers/promises";


test("hooks class", async (t) => {

	await t.test("addHook", async (t) => {
		const hooks = new Hooks() as any
		const fn = () => {};
		hooks.addHook("onMessage", fn);
		t.equal(hooks.hooks[hooks.hookSymbols.onMessage.S]?.[0], fn);
	});

	await t.test("runHook sync hook", async (t) => {
		const hooks = new Hooks() as any;
		let called = false;
		const fn = () => {
			called = true;
		};
		hooks.addHook("onMessage", fn);
		await t.resolves(hooks.runHook("onMessage"));
		t.equal(called, true);
	});

	await t.test("runHook async hook", async (t) => {
		const hooks = new Hooks() as any;
		let called = false;
		const fn = async () => {
			await setTimeout(100);
			called = true;
		};
		hooks.addHook("onMessage", fn);
		await t.resolves(hooks.runHook("onMessage"));
		t.equal(called, true);
	});

	await t.test("runHook with throwable error", async (t) => {
		const hooks = new Hooks();
		let called = false;
		const fn = async () => {
			await setTimeout(100);
			called = true;
			throw new Error("test");
		};
		hooks.addHook("onMessage", fn);
		await t.rejects(hooks.runHook("onMessage"));
		t.equal(called, true);
	});

	await t.test("runHook with silent error", async (t) => {
		let errorCalledMessage = "";
		const hooks = new Hooks({
			error(error: Error) {
				errorCalledMessage = error.message;
			}
		} as any);
		let called = false;
		const fn = async () => {
			await setTimeout(100);
			called = true;
			throw new Error("test");
		};
		hooks.addHook("onError", fn);
		await t.resolves(hooks.runHook("onError", true));
		t.equal(called, true);
		t.equal(errorCalledMessage, "Error running hook onError: test");
	});

	await t.test("add wrong Hook", async (t) => {
		const hooks = new Hooks();
		const fn = () => {};
		t.throws(() => hooks.addHook("onWrongHook" as any, fn));
	});
	await t.test("run wrong Hook", async (t) => {
		const hooks = new Hooks();
		await t.rejects(hooks.runHook("onWrongHook" as any));
	});
});