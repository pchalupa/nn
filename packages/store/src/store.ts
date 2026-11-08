import type { Encoded } from "@nn/entities/codable";
import { Codec } from "@nn/entities/codec";
import type { Entity } from "@nn/entities/entity";
import { Observable, type Unsubscribe } from "@nn/observable/observable";
import type { InferStateType, Schema } from "@nn/schema";
import type { ObjectSchema } from "@nn/schema/object-schema";

import { State } from "./state";

type ReadonlyData<Value> = {
	readonly [Key in keyof Value]: ReadonlyData<Value[Key]>;
};

export class Store<StateSchema extends ObjectSchema<Record<string, Schema>> = ObjectSchema<Record<string, Schema>>> {
	private changes = new Observable<[Readonly<Record<string, Encoded>>]>();
	private state: State<StateSchema>;
	private codec = new Codec();

	constructor(public readonly schema: StateSchema) {
		// TODO: Consider folding state into Store
		this.state = new State(schema);
		this.state.delegate = {
			stateDidChange: (changed: ReadonlySet<Entity>) => {
				const changes: Record<string, Encoded> = {};

				for (const entity of changed) {
					let encoded: Encoded | undefined;

					Object.defineProperty(changes, entity.key, {
						enumerable: true,
						get: () => (encoded ??= this.codec.encode(entity)),
					});
				}

				this.changes.notify(changes);
			},
		};
	}

	// TODO: Passthrough methods until State is merged into Store

	public read(): ReadonlyData<InferStateType<StateSchema>> {
		return this.state.read();
	}

	public update(recipe: (draft: InferStateType<StateSchema>) => void): void {
		this.state.update(recipe);
	}

	public encode(): Encoded<Record<string, Encoded>> {
		return this.state.encode();
	}

	public merge(name: string, value: unknown): void {
		const entity = this.codec.decode(value);

		this.state.merge(name, entity);
	}

	// TODO: Changes are there only for sse-sync to push only changed root
	public onChange(listener: (changes: Readonly<Record<string, Encoded>>) => void): Unsubscribe {
		return this.changes.subscribe(listener);
	}
}
