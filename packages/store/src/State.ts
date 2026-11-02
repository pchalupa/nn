import type { Entity } from "@nn/entities/Entity";
import type { Delegatable } from "@nn/observable";
import type { InferStateType, Schema } from "@nn/schema";
import type { ObjectSchema } from "@nn/schema/ObjectSchema";
import { Time } from "@nn/time";

import { Draft } from "./projectors/Draft";
import { View } from "./projectors/View";
import { createReconciliationStrategy } from "./reconciliation/createStrategy";
import type { MapStrategy } from "./reconciliation/MapStrategy";

type ReadonlyData<Value> = {
	readonly [Key in keyof Value]: ReadonlyData<Value[Key]>;
};

export interface StateDelegate {
	stateDidChange(state: State, changed: ReadonlySet<Entity>): void;
}

export class State<
	StoreSchema extends ObjectSchema<Record<string, Schema>> = ObjectSchema<Record<string, Schema>>,
> implements Delegatable<StateDelegate> {
	public delegate?: StateDelegate;
	private entities = new WeakMap<object, Entity>();
	private reconciliationStrategy: MapStrategy;
	private root: ReturnType<MapStrategy["create"]>;
	private view: View;
	private draft = new Draft(this.entities);
	private changed = new Set<Entity>();

	constructor(schema: StoreSchema) {
		// oxlint-disable-next-line typescript/consistent-type-assertions state root is forced to be map
		this.reconciliationStrategy = createReconciliationStrategy(schema, this.entities) as MapStrategy;

		this.root = this.reconciliationStrategy.create(undefined, "state", Time.epoch());
		this.view = new View(this.root, this.entities);
		this.root.delegate = {
			entityDidChange: (_entity, child) => {
				if (child) this.changed.add(child);
			},
		};
	}

	public read(): ReadonlyData<InferStateType<StoreSchema>>;
	public read(): unknown {
		return this.view.value;
	}

	public update(recipe: (draft: InferStateType<StoreSchema>) => void): void {
		// oxlint-disable-next-line typescript/consistent-type-assertions todo: fix this type casting
		const draft = this.draft.create(this.root) as InferStateType<StoreSchema>;

		recipe(draft);

		this.commit(() => this.reconciliationStrategy.reconcile(this.root, draft));
	}

	public merge(name: string, remote: Entity): void {
		this.commit(() => {
			const entity = this.root.get(name);

			if (entity !== undefined && remote.key === entity.key) entity.merge(remote);
		});
	}

	private commit(work: () => void): void {
		try {
			work();
		} finally {
			const changed = this.changed;

			this.changed = new Set();

			if (changed.size > 0) this.delegate?.stateDidChange(this, changed);
		}
	}
}
