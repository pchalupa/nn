import { EventEmitter } from "./EventEmitter";

export abstract class Repository extends EventEmitter<{ didSet: [id: string, value: unknown] }> {
	abstract get(id: unknown): unknown | undefined;

	abstract set(id: unknown, value: unknown): void;
}
