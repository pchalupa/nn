import { Entity, type InferValueType } from "@nn/entities/Entity";

import type { EntityMapping, EntityNode } from "./EntityMapping";
import { isArray, isObject } from "./guards";

interface Snapshot<Value> {
	readonly value: Value;
	readonly node: EntityNode;
}

interface CachedSnapshot extends Snapshot<unknown> {
	readonly revision: number;
}

export class View<State extends Entity = Entity> {
	private projection?: InferValueType<State>;
	private snapshots = new WeakMap<Entity, CachedSnapshot>();

	constructor(
		private state: State,
		private mapping: EntityMapping,
	) {}

	public get value(): InferValueType<State> {
		if (!this.projection) {
			this.projection = this.materialize(this.state).value;
		}

		return this.projection;
	}

	private materialize<EntityToMaterialize extends Entity>(
		entity: EntityToMaterialize,
	): Snapshot<InferValueType<EntityToMaterialize>>;
	private materialize(entity: Entity): Snapshot<unknown> {
		const revision = entity.revision;
		const cached = this.snapshots.get(entity);

		if (cached !== undefined && cached.revision === revision) return cached;

		const current = entity.current;
		const children = new Map<string, EntityNode>();
		const node: EntityNode = { entity, children };

		let value: unknown = current;

		if (isArray(current)) {
			const result: unknown[] = [];

			for (const [index, item] of current.entries()) {
				if (item instanceof Entity) {
					const child = this.materialize(item);

					result.push(child.value);
					children.set(String(index), child.node);
				} else result.push(structuredClone(item));
			}

			value = result;
		} else if (isObject(current)) {
			const result: Array<[string, unknown]> = [];

			for (const key in current) {
				const field: unknown = current[key];

				if (field instanceof Entity) {
					const child = this.materialize(field);

					result.push([key, child.value]);
					children.set(key, child.node);
				} else result.push([key, structuredClone(field)]);
			}

			value = Object.fromEntries(result);
		}

		if (isObject(value)) this.mapping.set(value, node);

		const snapshot: CachedSnapshot = { value, node, revision };

		this.snapshots.set(entity, snapshot);

		return snapshot;
	}

	public invalidate(): void {
		this.projection = undefined;
		this.snapshots.delete(this.state);
	}
}
