import { describe, expect, it } from "vitest";

import { assertEncoded } from "./codable";

describe("assertEncoded", () => {
	it("accepts an entry with a string kind", () => {
		expect(() => assertEncoded({ key: "k", data: null, metadata: { kind: "LWWRegister" } })).not.toThrow();
	});

	it.each([
		undefined,
		null,
		"entry",
		{ key: "k", data: null },
		{ key: "k", data: null, metadata: null },
		{ key: "k", data: null, metadata: {} },
		{ key: "k", data: null, metadata: { kind: 1 } },
	])("rejects %o", (value) => {
		expect(() => assertEncoded(value)).toThrow("Invalid encoded entity.");
	});
});
