import { Snapshot } from "../snapshot/Snapshot";

export class Collection<Type> extends Array<Type> {
	static createCollectionOf<T>(): Collection<T> {
		return new Collection<T>();
	}

	createSnapshot(onPush: () => void): Snapshot<Type> {
		return new Snapshot<Type>(this, onPush);
	}
}
