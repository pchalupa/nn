import { Time } from "@nn/time";
import { describe, expect, it, vi } from "vitest";

import { LWWMap } from "./LWWMap";
import { LWWRegister } from "./LWWRegister";

describe("LWWMap", () => {
	it("creates a map with initial value", () => {
		const map = new LWWMap({ name: new LWWRegister("John"), age: new LWWRegister(30) });

		expect(map.current.name.current).toBe("John");
		expect(map).toBeInstanceOf(LWWMap);
	});

	it("serializes map", () => {
		const map = new LWWMap({ name: new LWWRegister("John"), address: new LWWMap({ city: new LWWRegister("Prague") }) });

		expect(JSON.stringify(map)).toMatchInlineSnapshot(`"{"name":"John","address":{"city":"Prague"}}"`);
	});

	it("encodes its fields", () => {
		const name = new LWWRegister("John", "name");
		const map = new LWWMap({ name }, "person");

		expect(map.encode()).toStrictEqual({ key: "person", data: { name: name.encode() }, metadata: { kind: "LWWMap" } });
	});

	it("updates property value and reflect changes", () => {
		const map = new LWWMap({ name: new LWWRegister("Alice"), age: new LWWRegister(25) });

		expect(map.current.name.current).toBe("Alice");
		expect(map.current.age.current).toBe(25);

		map.current.name.current = "Bob";
		map.current.age.current = 40;

		expect(map.current.name.current).toBe("Bob");
		expect(map.current.age.current).toBe(40);
	});

	it("writes values through set", () => {
		const map = new LWWMap({ name: new LWWRegister("John"), age: new LWWRegister(30) });

		map.set((current) => ({ ...current, name: new LWWRegister("Jane") }));
		map.current.name.current = "Jane";

		expect(map.current.name.current).toBe("Jane");
		expect(map.current.age.current).toBe(30);
	});

	it("merges maps with multiple properties", () => {
		const mapA = new LWWMap({ name: new LWWRegister("foo"), age: new LWWRegister(20) });
		const mapB = new LWWMap({ name: new LWWRegister("bar"), age: new LWWRegister(30) });

		const result = mapA.merge(mapB);

		expect(result.current.name.current).toBe("bar");
		expect(result.current.age.current).toBe(30);
	});

	it("exclude remote‐only keys when merging", () => {
		const a = new LWWMap({ foo: new LWWRegister("a") });
		const b = new LWWMap({ foo: new LWWRegister("b"), bar: new LWWRegister(1) });

		const result = a.merge(b);

		expect(result.current.foo.current).toBe("b");
		expect("bar" in result.current).toBeFalsy();
	});

	it("reports a field change with the field as child", () => {
		const name = new LWWRegister("John");
		const map = new LWWMap({ name });
		const delegate = { entityDidChange: vi.fn() };

		map.delegate = delegate;
		name.current = "Jane";

		expect(delegate.entityDidChange).toHaveBeenCalledExactlyOnceWith(map, name);
		expect(map.revision).toBe(1);
	});

	it("detaches a replaced field", () => {
		const old = new LWWRegister("John");
		const next = new LWWRegister("Jane");
		const map = new LWWMap({ name: old });
		const delegate = { entityDidChange: vi.fn() };

		map.current = { name: next };
		map.delegate = delegate;
		old.current = "Ignored";
		next.current = "Seen";

		expect(old.delegate).toBeUndefined();
		expect(delegate.entityDidChange).toHaveBeenCalledExactlyOnceWith(map, next);
	});

	it("forwards a field merge that the remote wins", () => {
		const local = new LWWRegister("old", "name", Time.epoch());
		const map = new LWWMap({ name: local });
		const delegate = { entityDidChange: vi.fn() };

		map.delegate = delegate;
		map.merge(new LWWMap({ name: new LWWRegister("new", "name") }));

		expect(delegate.entityDidChange).toHaveBeenCalledExactlyOnceWith(map, local);
	});

	it("returns a field entity by name", () => {
		const title = new LWWRegister("Ticket", "title");
		const map = new LWWMap({ title }, "row-1");

		expect(map.get("title")).toBe(title);
	});

	it("returns undefined for an undeclared field", () => {
		const map = new LWWMap({ title: new LWWRegister("Ticket", "title") }, "row-1");

		expect(map.get("missing")).toBeUndefined();
	});
});
