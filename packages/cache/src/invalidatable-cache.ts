const stale: unique symbol = Symbol("stale");

export class InvalidatableCache<Value> {
	private value: Value | typeof stale = stale;

	public ensure(load: () => Value): Value {
		if (this.value === stale) this.value = load();

		return this.value;
	}

	public invalidate(): void {
		this.value = stale;
	}
}
