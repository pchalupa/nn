import { describe, expect, it } from "vitest";

import { Codec } from "./codec";
import { LWWMap } from "./lww-map";
import { LWWRegister } from "./lww-register";
import { RGA } from "./rga";

describe("Codec", () => {
	const codec = new Codec();

	it("round-trips a register with its key, value and timestamp", () => {
		const register = new LWWRegister("value", "title");
		const decoded = codec.decode(codec.encode(register));

		expect(decoded).toBeInstanceOf(LWWRegister);
		expect(decoded.encode()).toStrictEqual(register.encode());
	});

	it("round-trips a list with removed keys and keeps them removed", () => {
		const list = new RGA([new LWWRegister("a", "1"), new LWWRegister("b", "2")], "list");

		list.remove("1");

		const decoded = codec.decode(JSON.parse(JSON.stringify(codec.encode(list))));

		expect(decoded.encode()).toStrictEqual(list.encode());

		RGA.assert(decoded);

		decoded.merge(new RGA([new LWWRegister("a", "1")], "list"));

		expect(decoded.get("1")).toBeUndefined();
	});

	it("round-trips a map holding a list of maps", () => {
		const items = new RGA(
			[
				new LWWMap({ title: new LWWRegister("First", "title") }, "item-1"),
				new LWWMap({ title: new LWWRegister("Second", "title") }, "item-2"),
			],
			"items",
		);
		const board = new LWWMap({ items }, "board");
		const decoded = codec.decode(codec.encode(board));

		expect(decoded).toBeInstanceOf(LWWMap);
		expect(decoded.encode()).toStrictEqual(board.encode());
	});

	it("throws for an invalid entry", () => {
		expect(() => codec.decode({ key: "k", data: null })).toThrow("Invalid encoded entity.");
	});

	it.each([
		[{ key: "k", data: "a", metadata: { kind: "LWWRegister" } }, "Invalid encoded LWWRegister."],
		[{ key: "k", data: "a", metadata: { kind: "LWWRegister", timestamp: 1 } }, "Invalid encoded LWWRegister."],
		[{ key: "k", data: null, metadata: { kind: "LWWMap" } }, "Invalid encoded LWWMap."],
		[{ key: "k", data: [], metadata: { kind: "LWWMap" } }, "Invalid encoded LWWMap."],
		[{ key: "k", data: 5, metadata: { kind: "RGA", tombstones: [] } }, "Invalid encoded RGA."],
		[{ key: "k", data: [], metadata: { kind: "RGA" } }, "Invalid encoded RGA."],
		[{ key: "k", data: [], metadata: { kind: "RGA", tombstones: [1] } }, "Invalid encoded RGA."],
		[{ key: "k", data: { name: 1 }, metadata: { kind: "LWWMap" } }, "Invalid encoded entity."],
		[{ key: "k", data: [null], metadata: { kind: "RGA", tombstones: [] } }, "Invalid encoded entity."],
	])("throws for malformed data or metadata %o", (value, message) => {
		expect(() => codec.decode(value)).toThrow(message);
	});

	it.each(["toString", "Missing"])("throws for the unknown kind %s", (kind) => {
		expect(() => codec.decode({ key: "k", data: null, metadata: { kind } })).toThrow(`Unknown entity kind "${kind}".`);
	});
});
