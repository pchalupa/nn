import { LWWRegister } from "@nn/entities/LWWRegister";
import { RGA } from "@nn/entities/RGA";
import { EventEmitter } from "@nn/event-emitter";
import type { Unsubscribe } from "@nn/event-emitter/Observable";
import { ID } from "@nn/id";
import { ArraySchema, type Infer, ObjectSchema, type Schema, StringSchema } from "@nn/schema";
import { Time } from "@nn/time";

import { Batch } from "./Batch";
import { equal } from "./equal";
import { PathError } from "./errors/PathError";
import { StoreError } from "./errors/StoreError";
import { normalize, normalizeObject, plainRow } from "./normalize";
import type { Path, PathDraft, PathValue, Recipe } from "./Path";
import { capture, type RootEntry, type Prepare, restore, type Root } from "./persistence";
import { clone, isPlainObject, snapshot } from "./View";

export type DataFromSchema<StoreSchema extends ObjectSchema<Record<string, Schema>>> = {
	[Key in keyof StoreSchema["properties"]]: DataFromShape<StoreSchema["properties"][Key]>;
};

type DataFromShape<Shape extends Schema> =
	Shape extends ArraySchema<infer Item>
		? Array<{ [Key in keyof Infer<Item> | "key"]: (Infer<Item> & { key: string })[Key] }>
		: Shape extends StringSchema
			? string | undefined
			: never;

type DataFromEntries<Entries extends Record<string, Root>> = {
	[Key in keyof Entries]: Entries[Key] extends RGA<LWWRegister<infer Row>>
		? Array<Row & { key: string }>
		: Entries[Key] extends LWWRegister<infer Value>
			? Value
			: never;
};

function isKeyed(item: unknown): item is Record<string, unknown> & { key: string } {
	return isPlainObject(item) && typeof item.key === "string";
}

function valueAt<Value>(value: unknown, fields: readonly string[], path: readonly string[]): Value;
function valueAt(value: unknown, fields: readonly string[], path: readonly string[]): unknown {
	let current = value;
	for (const field of fields) {
		if (!isPlainObject(current) || !Object.hasOwn(current, field)) throw PathError.invalid(path);
		current = current[field];
	}
	return current;
}

function assignAt(target: unknown, fields: readonly string[], value: unknown, path: readonly string[]): unknown {
	const parent = valueAt(target, fields.slice(0, -1), path);
	const field = fields.at(-1);
	if (!isPlainObject(parent) || field === undefined) throw PathError.invalid(path);
	parent[field] = value;
	return target;
}

export class State<Data extends Record<string, unknown>> {
	private views = new Map<string, unknown>();
	private changed = new Set<string>();
	private batch = new Batch();
	private emitter = new EventEmitter<{ change: [ReadonlySet<string>] }>();

	private constructor(
		private readonly entries: ReadonlyMap<string, Root>,
		private readonly preparers: ReadonlyMap<string, Prepare>,
		persisted: ReadonlyMap<string, unknown>,
	) {
		for (const [name, root] of entries) {
			const stored = persisted.get(name);
			if (stored !== undefined) restore(name, root, stored, this.prepare(name, root));
		}
		for (const [name, root] of entries) {
			root.subscribe(() => {
				this.views.delete(name);
				this.changed.add(name);
				this.batch.request(() => this.publish());
			});
		}
	}

	public static fromEntries<Entries extends Record<string, Root>>(entries: Entries): State<DataFromEntries<Entries>> {
		return new State<DataFromEntries<Entries>>(new Map(Object.entries(entries)), new Map(), new Map());
	}

	public static fromSchema<StoreSchema extends ObjectSchema<Record<string, Schema>>>(
		schema: StoreSchema,
		persisted: ReadonlyMap<string, unknown> = new Map(),
	): State<DataFromSchema<StoreSchema>> {
		const entries = new Map<string, Root>();
		const preparers = new Map<string, Prepare>();
		for (const [name, shape] of Object.entries(schema.properties)) {
			if (ArraySchema.isArraySchema(shape)) {
				const item = shape.items;
				if (!ObjectSchema.isObjectSchema(item)) {
					throw new TypeError(`A collection item has to be an object schema, got "${item.type}".`);
				}
				if (Object.hasOwn(item.properties, "key")) {
					throw new TypeError(`"${name}" declares a "key" property, which names a row in its collection.`);
				}
				entries.set(name, new RGA([], name));
				preparers.set(name, (data, key) => ({ ...normalizeObject(item, plainRow(data, key)), key }));
			} else if (StringSchema.isStringSchema(shape)) {
				entries.set(name, new LWWRegister(normalize(shape, undefined), name, Time.epoch()));
				preparers.set(name, (value) => normalize(shape, value));
			} else {
				throw new TypeError(`Unsupported top-level schema shape "${shape.type}" for "${name}".`);
			}
		}
		return new State<DataFromSchema<StoreSchema>>(entries, preparers, persisted);
	}

	public capture(name: string): RootEntry {
		return capture(this.root([name]));
	}

	public subscribe(listener: (changed: ReadonlySet<string>) => void): Unsubscribe {
		this.emitter.on("change", listener);
		return () => this.emitter.off("change", listener);
	}

	public read<const Segments extends Path<Data>>(path: Segments): PathValue<Data, Segments>;
	public read(path: readonly string[]): unknown {
		const [, key, ...fields] = path;
		const view = this.view(path);
		if (key === undefined) return view;
		if (!Array.isArray(view)) throw PathError.invalid(path);
		const row: unknown = view.find((item: unknown) => isKeyed(item) && item.key === key);
		return row === undefined ? undefined : valueAt(row, fields, path);
	}

	public write<const Segments extends Path<Data>>(
		path: Segments,
		recipe: Recipe<NoInfer<PathDraft<Data, Segments>>>,
	): void {
		this.batch.run(() => {
			const [, key, ...fields] = path;
			const root = this.root(path);
			const prepare = this.prepare(path[0], root);
			if (key === undefined) {
				const next = recipe(valueAt(clone(this.view(path)), [], path));
				if (root instanceof RGA) State.reconcile(root, next, prepare);
				else State.assign(root, clone(prepare(next, root.key)));
				return;
			}
			if (!(root instanceof RGA)) throw PathError.invalid(path);
			const row = root.find(key);
			if (row === undefined) throw PathError.missing(path);
			const draft = clone(row.current);
			const next =
				fields.length === 0
					? recipe(valueAt(draft, [], path))
					: assignAt(draft, fields, recipe(valueAt(draft, fields, path)), path);
			State.assign(row, clone(prepare(next, key)));
		});
	}

	private root(path: readonly string[]): Root {
		const root = path[0] === undefined ? undefined : this.entries.get(path[0]);
		if (root === undefined) throw PathError.invalid(path);
		return root;
	}

	private prepare(name: string, root: Root): Prepare {
		return this.preparers.get(name) ?? (root instanceof RGA ? plainRow : (value) => value);
	}

	private view(path: readonly string[]): unknown {
		const root = this.root(path);
		const name = path[0] ?? "";
		if (!this.views.has(name)) {
			this.views.set(name, snapshot(root instanceof RGA ? root.current.map((row) => row.current) : root.current));
		}
		return this.views.get(name);
	}

	private publish(): void {
		const changed = new Set(this.changed);
		this.changed.clear();
		if (changed.size > 0) this.emitter.emit("change", changed);
	}

	private static assign(register: LWWRegister<unknown>, value: unknown): void {
		if (!equal(register.current, value)) register.current = value;
	}

	private static reconcile(collection: RGA<LWWRegister<unknown>>, next: unknown, prepare: Prepare): void {
		if (!Array.isArray(next)) throw StoreError.mismatch("a collection array");
		const items: readonly unknown[] = next;
		const rows = new Map<string, unknown>();
		for (const item of items) {
			const key = isKeyed(item) ? item.key : ID.create();
			if (rows.has(key)) throw StoreError.duplicateKey(key);
			rows.set(key, clone(prepare(item, key)));
		}
		for (const row of collection.current) {
			if (!rows.has(row.key)) collection.remove(row.key);
		}
		for (const [key, value] of rows) {
			const row = collection.find(key);
			if (row === undefined) collection.push(new LWWRegister(value, key));
			else State.assign(row, value);
		}
	}
}
