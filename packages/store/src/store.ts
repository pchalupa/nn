import type { Encoded } from "@nn/entities/codable";
import { Codec } from "@nn/entities/codec";
import type { Entity } from "@nn/entities/entity";
import type { LWWMap } from "@nn/entities/kinds/lww-map";
import { Observable, type Unsubscribe } from "@nn/observable/observable";
import type { InferStateType, Schema } from "@nn/schema";
import type { ObjectSchema } from "@nn/schema/object-schema";
import { Time } from "@nn/time";

import { Draft } from "./projections/draft";
import { View } from "./projections/view";
import { createReconciliationStrategy } from "./reconciliation/create-strategy";
import type { MapStrategy } from "./reconciliation/map-strategy";

type ReadonlyData<Value> = {
	readonly [Key in keyof Value]: ReadonlyData<Value[Key]>;
};

/**
 * State container
 *
 * @example
 * const store = new Store(object({ language: enumeration("en", "cs"), tags: array(object({ name: string() })) }));
 *
 * store.mutate((state) => {
 * 	state.language = "cs";
 * 	state.tags.push({ name: "urgent" });
 * });
 *
 * store.query((state) => state.tags.length); // 1
 */
export class Store<StateSchema extends ObjectSchema<Record<string, Schema>> = ObjectSchema<Record<string, Schema>>> {
	private view = new View();
	private codec = new Codec();
	private changes = new Observable<[Readonly<Record<string, Encoded>>]>();
	private reconciliationStrategy: MapStrategy;
	private root: LWWMap<Record<string, Entity>>;
	public readonly schema: StateSchema;

	constructor(schema: StateSchema) {
		this.schema = schema;
		this.reconciliationStrategy = createReconciliationStrategy(schema);
		this.root = this.reconciliationStrategy.create(undefined, "state", Time.epoch());
	}

	/**
	 * Runs `selector` on the frozen state. Unchanged parts keep their reference between calls.
	 *
	 * @example
	 * const language = store.query((state) => state.language);
	 * const urgent = store.query((state) => state.tags.filter((tag) => tag.name === "urgent"));
	 */
	public query<Result>(selector: (state: ReadonlyData<InferStateType<StateSchema>>) => Result): Result {
		// TODO: Avoid type cast
		// oxlint-disable-next-line typescript/consistent-type-assertions
		const state = this.view.read(this.root) as ReadonlyData<InferStateType<StateSchema>>;

		return selector(state);
	}

	/**
	 * Changes the state through a draft.
	 *
	 * @example
	 * store.mutate((state) => {
	 * 	state.tags = state.tags.filter((tag) => tag.name !== "urgent");
	 * });
	 */
	public mutate(recipe: (draft: InferStateType<StateSchema>) => void): void {
		const draft = new Draft(this.root, this.view);

		// oxlint-disable-next-line typescript/consistent-type-assertions todo: fix this type casting
		recipe(draft.value as InferStateType<StateSchema>);

		this.commit(() =>
			this.reconciliationStrategy.reconcile(this.root, draft.value, {
				inspect: (value) => draft.inspect(value),
				fill: (entity) => draft.fill(entity),
				identify: (value) => draft.identify(value),
				resolve: (item, parent, key) => draft.resolve(item, parent, key),
			}),
		);
	}

	/**
	 * Returns one encoded entry per root property in `data`.
	 *
	 * @example
	 * localStorage.setItem("snapshot", JSON.stringify(store.encode().data));
	 */
	public encode(): Encoded<Record<string, Encoded>> {
		return this.root.encode();
	}

	/**
	 * Merges an encoded entry from another replica into the root property `name`. An entry whose kind doesn't match the
	 * schema is ignored.
	 *
	 * @throws {TypeError} When `value` isn't a valid encoded entity.
	 * @throws {TimestampMalformedError} When a timestamp can't be parsed.
	 *
	 * @example
	 * worker.onmessage = (event) => store.merge(event.data.name, event.data.entry);
	 */
	public merge(name: string, value: unknown): void {
		const remote = this.codec.decode(value);

		this.commit(() => {
			const entity = this.root.get(name);
			const strategy = this.reconciliationStrategy.get(name);
			const conformed = strategy?.conform(remote);

			if (entity && conformed && remote.key === entity.key) {
				entity.merge(conformed);
			}
		});
	}

	// TODO: Changes are there only for sse-sync to push only changed root
	/**
	 * Calls `listener` after each change with the changed root properties as encoded entries.
	 *
	 * @example
	 * const unsubscribe = store.onChange((changes) => {
	 * 	socket.send(JSON.stringify(changes));
	 * });
	 */
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
