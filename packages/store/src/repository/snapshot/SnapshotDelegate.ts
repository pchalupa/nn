export class SnapshotDelegate<Type = unknown> {
	public onPush?: (value: Type) => void;
}
