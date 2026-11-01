import { describe, expect, it } from "vitest";

import { Codec } from "./Codec";
import { LWWMap } from "./LWWMap";
import { LWWRegister } from "./LWWRegister";
import { RGA } from "./RGA";

describe("Codec", () => {
	const codec = new Codec();

	it("round-trips a register with its key, value and timestamp", () => {
		const register = new LWWRegister("value", "title");
		const decoded = codec.decode(codec.encode(register));

		expect(decoded).toBeInstanceOf(LWWRegister);
		expect(decoded.encode()).toStrictEqual(register.encode());
	});

	it("round-trips a map of registers", () => {
		const map = new LWWMap({ name: new LWWRegister("Ann", "name") }, "person");
		const decoded = codec.decode(codec.encode(map));

		expect(decoded).toBeInstanceOf(LWWMap);
		expect(decoded.encode()).toStrictEqual(map.encode());
	});

	it("round-trips a list of registers in order", () => {
		const list = new RGA([new LWWRegister("a", "1"), new LWWRegister("b", "2")], "list");
		const decoded = codec.decode(codec.encode(list));

		expect(decoded).toBeInstanceOf(RGA);
		expect(decoded.encode()).toStrictEqual(list.encode());
	});

	it("round-trips a map holding a list of maps", () => {
		const rows = new RGA(
			[
				new LWWMap({ title: new LWWRegister("First", "title") }, "row-1"),
				new LWWMap({ title: new LWWRegister("Second", "title") }, "row-2"),
			],
			"rows",
		);
		const board = new LWWMap({ rows }, "board");
		const decoded = codec.decode(codec.encode(board));

		expect(decoded).toBeInstanceOf(LWWMap);
		expect(decoded.encode()).toStrictEqual(board.encode());
	});

	it.each([
		undefined,
		"cs",
		{ key: "k", data: null },
		{ key: "k", data: null, metadata: null },
		{ key: "k", data: null, metadata: {} },
	])("throws for an invalid entry %o", (value) => {
		expect(() => codec.decode(value)).toThrow("Invalid encoded entity.");
	});

	it.each([
		[{ key: "k", data: "a", metadata: { kind: "LWWRegister" } }, "Invalid encoded LWWRegister."],
		[{ key: "k", data: "a", metadata: { kind: "LWWRegister", timestamp: 1 } }, "Invalid encoded LWWRegister."],
		[{ key: "k", data: null, metadata: { kind: "LWWMap" } }, "Invalid encoded LWWMap."],
		[{ key: "k", data: [], metadata: { kind: "LWWMap" } }, "Invalid encoded LWWMap."],
		[{ key: "k", data: "a", metadata: { kind: "LWWMap" } }, "Invalid encoded LWWMap."],
		[{ key: "k", data: 5, metadata: { kind: "RGA" } }, "Invalid encoded RGA."],
		[{ key: "k", data: {}, metadata: { kind: "RGA" } }, "Invalid encoded RGA."],
		[{ key: "k", data: { name: 1 }, metadata: { kind: "LWWMap" } }, "Invalid encoded entity."],
		[{ key: "k", data: [null], metadata: { kind: "RGA" } }, "Invalid encoded entity."],
	])("throws for malformed data or metadata %o", (value, message) => {
		expect(() => codec.decode(value)).toThrow(message);
	});

	it("throws for a kind inherited from the object prototype", () => {
		expect(() => codec.decode({ key: "k", data: null, metadata: { kind: "toString" } })).toThrow(
			'Unknown entity kind "toString".',
		);
	});

	it("throws for an unknown kind", () => {
		expect(() => codec.decode({ key: "k", data: null, metadata: { kind: "Missing" } })).toThrow(
			'Unknown entity kind "Missing".',
		);
	});
});
