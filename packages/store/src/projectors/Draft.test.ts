import type { Entity } from "@nn/entities/Entity";
import { LWWMap } from "@nn/entities/kinds/LWWMap";
import { LWWRegister } from "@nn/entities/kinds/LWWRegister";
import { RGA } from "@nn/entities/kinds/RGA";
import { assertArray } from "@nn/guards/assertArray";
import { assertObject } from "@nn/guards/assertObject";
import { describe, expect, it } from "vitest";

import { Draft } from "./Draft";

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
