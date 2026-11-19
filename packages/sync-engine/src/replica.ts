import type { Unsubscribe } from "@nn/observable/observable";

export interface Replica {
	readonly schema: { readonly properties: Readonly<Record<string, unknown>> };

	encode(): { data: Readonly<Record<string, unknown>> };
	merge(name: string, value: unknown): void;
	onChange(listener: (changes: Readonly<Record<string, unknown>>) => void): Unsubscribe;
}
