import { EventEmitter } from "@nn/event-emitter";

export abstract class Repository<Value> {
	public events = new EventEmitter<{ didSet: [id: string, value: Value] }>();

	abstract get(id: string): Value | undefined;

	abstract set(id: string, value: Value): void;
}
