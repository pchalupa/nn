import { Entity, type InferValueType } from "@nn/entities/Entity";

import type { EntityMapping } from "./EntityMapping";
import { isArray, isObject } from "./guards";

interface Snapshot<Value> {
	readonly value: Value;
}

interface CachedSnapshot extends Snapshot<unknown> {
	readonly revision: number;
}

export class View<State extends Entity = Entity> {
	private projection?: Snapshot<InferValueType<State>>;
	private snapshots = new WeakMap<Entity, CachedSnapshot>();

	constructor(
		private state: State,
		private mapping: EntityMapping,
	) {}

	public get value(): InferValueType<State> {
		this.projection ??= this.materialize(this.state);

		return this.projection.value;
	}

	private materialize<EntityToMaterialize extends Entity>(
		entity: EntityToMaterialize,
	): Snapshot<InferValueType<EntityToMaterialize>>;
	private materialize(entity: Entity): Snapshot<unknown> {
		const revision = entity.revision;
		const cached = this.snapshots.get(entity);

		if (cached !== undefined && cached.revision === revision) return cached;

		const current = entity.current;

		if (!isObject(current)) return { value: current };

		let value: unknown = current;

		if (isArray(current)) {
			const result: unknown[] = [];

			for (const item of current) {
				result.push(item instanceof Entity ? this.materialize(item).value : structuredClone(item));
			}

			value = result;
		} else if (isObject(current)) {
			const result: Array<[string, unknown]> = [];

			for (const key in current) {
				const field: unknown = current[key];

				result.push([key, field instanceof Entity ? this.materialize(field).value : structuredClone(field)]);
			}

			value = Object.fromEntries(result);
		}

		if (isObject(value)) this.mapping.set(value, entity);

		const snapshot: CachedSnapshot = { value, revision };

		this.snapshots.set(entity, snapshot);

		return snapshot;
	}

	public invalidate(): void {
		this.projection = undefined;
		this.snapshots.delete(this.state);
	}
}
