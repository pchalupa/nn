export class SnapshotDelegate<Type = unknown> {
	public didPush?: (value: Type) => void;
}
