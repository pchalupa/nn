import { LWWRegister } from "@nn/entities/LWWRegister";
import { RGA } from "@nn/entities/RGA";
import type { Entry } from "@nn/repository";
import { Time } from "@nn/time";

import { StoreError } from "./errors/StoreError";
import { clone, isPlainObject, snapshot } from "./View";

export type Root = LWWRegister<unknown> | RGA<LWWRegister<unknown>>;

export type Prepare = (value: unknown, key: string) => unknown;

export type RegisterEntry = Entry<unknown, { kind: "register"; timestamp: string }>;

export type CollectionEntry = Entry<readonly RegisterEntry[], { kind: "collection" }>;

export type RootEntry = RegisterEntry | CollectionEntry;

function isEntry(value: unknown, kind: string): value is Entry {
	return (
		isPlainObject(value) &&
		typeof value.key === "string" &&
		Object.hasOwn(value, "data") &&
		isPlainObject(value.metadata) &&
		value.metadata.kind === kind
	);
}

function isRegisterEntry(value: unknown): value is RegisterEntry {
	return isEntry(value, "register") && typeof value.metadata.timestamp === "string";
}

function isCollectionEntry(value: unknown): value is CollectionEntry {
	return isEntry(value, "collection") && Array.isArray(value.data) && value.data.every(isRegisterEntry);
}

function captureRegister(register: LWWRegister<unknown>): RegisterEntry {
	return {
		key: register.key,
		data: snapshot(register.current),
		metadata: { kind: "register", timestamp: register.timestamp.toString() },
	};
}

export function capture(root: Root): RootEntry {
	if (root instanceof LWWRegister) return captureRegister(root);
	return { key: root.key, data: root.current.map(captureRegister), metadata: { kind: "collection" } };
}

function restoreRegister(entry: RegisterEntry, value: unknown): LWWRegister<unknown> {
	const timestamp = Time.fromTimestamp(entry.metadata.timestamp);
	return new LWWRegister(value, entry.key, timestamp);
}

export function restore(name: string, root: Root, stored: unknown, prepare: Prepare): void {
	try {
		if (root instanceof RGA) {
			if (!isCollectionEntry(stored) || stored.key !== root.key) {
				throw new TypeError("Expected a collection entry.");
			}
			root.merge(new RGA(stored.data.map((row) => restoreRegister(row, clone(prepare(row.data, row.key))))));
		} else {
			if (!isRegisterEntry(stored) || stored.key !== root.key) {
				throw new TypeError("Expected a register entry.");
			}
			root.merge(restoreRegister(stored, clone(prepare(stored.data, root.key))));
		}
	} catch (cause) {
		throw StoreError.persistence(name, cause);
	}
}
