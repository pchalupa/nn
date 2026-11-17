export class VersionedCache<Key extends object, Value> {
	private entries = new WeakMap<Key, { value: Value; version: number }>();

	public ensure(key: Key, version: number, load: (key: Key) => Value): Value {
		const entry = this.entries.get(key);

		if (entry && entry.version === version) return entry.value;

		const value = load(key);

		this.entries.set(key, { value, version });

		return value;
	}
}
