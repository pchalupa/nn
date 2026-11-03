import type { Entity } from "@nn/entities/entity";
import { LWWMap } from "@nn/entities/kinds/lww-map";
import { LWWRegister } from "@nn/entities/kinds/lww-register";
import { RGA } from "@nn/entities/kinds/rga";
import { assertArray } from "@nn/guards/assert-array";
import { assertObject } from "@nn/guards/assert-object";
import { describe, expect, it } from "vitest";

import { Draft } from "./draft";

describe("Draft", () => {
	it("copies an entity tree independently and records entities", () => {
		const tags = new RGA([new LWWRegister("red", "first")], "tags");
		const settings = new LWWMap({ tags }, "settings");
		const entities = new WeakMap<object, Entity>();
		const draft = new Draft(entities);
		const copy = draft.create(settings);

		expect(copy).toStrictEqual({ tags: ["red"] });

		assertObject(copy);
		assertArray(copy.tags);

		expect(entities.get(copy)).toBe(settings);
		expect(entities.get(copy.tags)).toBe(tags);
		expect(draft.create(settings)).not.toBe(copy);
	});
});
