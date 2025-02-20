import { SnapshotManager } from "./snapshot/SnapshotManager";

export abstract class Repository {
	protected snapshotManager = new SnapshotManager();

	abstract get(id: unknown): unknown | undefined;

	abstract set(id: unknown, value: unknown): void;

	getSnapshotById<Type>(id: unknown) {
		return this.snapshotManager.getSnapshotById<Type>(id);
	}

	createSnapshot<Type>(id: unknown, data: Type, onPush: () => void) {
		return this.snapshotManager.createSnapshot<Type>(id, data, onPush);
	}
}
