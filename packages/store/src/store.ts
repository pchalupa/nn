import type { Encoded } from "@nn/entities/codable";
import { Codec } from "@nn/entities/codec";
import type { Entity } from "@nn/entities/entity";
import { Observable, type Unsubscribe } from "@nn/observable/observable";
import type { InferStateType, Schema } from "@nn/schema";
import type { ObjectSchema } from "@nn/schema/object-schema";
import { Time } from "@nn/time";

import { Draft } from "./projections/draft";
import { View } from "./projections/view";
import { createReconciliationStrategy } from "./reconciliation/create-strategy";
import { MapStrategy } from "./reconciliation/map-strategy";

type ReadonlyData<Value> = {
	readonly [Key in keyof Value]: ReadonlyData<Value[Key]>;
};

export class Store<StateSchema extends ObjectSchema<Record<string, Schema>> = ObjectSchema<Record<string, Schema>>> {
	private changes = new Observable<[Readonly<Record<string, Encoded>>]>();
	private codec = new Codec();
	private view = new View();
	private reconciliationStrategy: MapStrategy;
	private root: ReturnType<MapStrategy["create"]>;

	constructor(public readonly schema: StateSchema) {
		const reconciliationStrategy = createReconciliationStrategy(schema);

		MapStrategy.assert(reconciliationStrategy);

		this.reconciliationStrategy = reconciliationStrategy;
		this.root = this.reconciliationStrategy.create(undefined, "state", Time.epoch());
	}

	// TODO: Avoid overloading to cast the type
	public read(): ReadonlyData<InferStateType<StateSchema>>;
	public read(): unknown {
		return this.view.read(this.root);
	}

	public update(recipe: (draft: InferStateType<StateSchema>) => void): void {
		const draft = new Draft(this.root, this.view);

		// oxlint-disable-next-line typescript/consistent-type-assertions todo: fix this type casting
		recipe(draft.value as InferStateType<StateSchema>);

		this.commit(() =>
			this.reconciliationStrategy.reconcile(this.root, draft.value, {
				inspect: (value) => draft.inspect(value),
				fill: (entity) => draft.fill(entity),
				identify: (value) => draft.identify(value),
			}),
		);
	}

	public encode(): Encoded<Record<string, Encoded>> {
		return this.root.encode();
	}

	public merge(name: string, value: unknown): void {
		const remote = this.codec.decode(value);

		this.commit(() => {
			const entity = this.root.get(name);
			const strategy = this.reconciliationStrategy.get(name);

			if (entity && strategy && remote.key === entity.key) {
				entity.merge(strategy.conform(remote));
			}
		});
	}

	// TODO: Changes are there only for sse-sync to push only changed root
	public onChange(listener: (changes: Readonly<Record<string, Encoded>>) => void): Unsubscribe {
		return this.changes.subscribe(listener);
	}

	private commit(work: () => void): void {
		const changed = new Set<Entity>();

		this.root.delegate = {
			entityDidChange: (_entity, child) => {
				if (child) changed.add(child);
			},
		};

		try {
			work();
		} finally {
			this.root.delegate = undefined;

			if (changed.size > 0) {
				const changes: Record<string, Encoded> = {};

				// TODO: Refactor this block to avoid up front loop and turn the changes to array of encoded entities.
				for (const entity of changed) {
					let encoded: Encoded | undefined;

					Object.defineProperty(changes, entity.key, {
						enumerable: true,
						get: () => (encoded ??= this.codec.encode(entity)),
					});
				}

				this.changes.notify(changes);
			}
		}
	}
}
