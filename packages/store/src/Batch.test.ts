import { describe, expect, it } from "vitest";

import { Batch } from "./Batch";

describe("Batch", () => {
	it("runs the callback immediately", () => {
		const batch = new Batch();
		const calls: string[] = [];

		batch.request(() => calls.push("immediate"));

		expect(calls).toStrictEqual(["immediate"]);
	});

	it("runs the last callback", () => {
		const batch = new Batch();
		const calls: string[] = [];

		batch.run(() => {
			batch.request(() => calls.push("first"));
			batch.request(() => calls.push("second"));
			batch.request(() => calls.push("last"));
		});

		expect(calls).toStrictEqual(["last"]);
	});

	it("runs only the last requested callback across nested runs", () => {
		const batch = new Batch();
		const calls: string[] = [];

		batch.run(() => {
			batch.request(() => calls.push("first"));
			batch.run(() => batch.request(() => calls.push("nested")));

			expect(calls).toStrictEqual([]);

			batch.request(() => calls.push("last"));
		});

		expect(calls).toStrictEqual(["last"]);
	});
});
