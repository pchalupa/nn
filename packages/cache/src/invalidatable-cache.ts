const stale: unique symbol = Symbol("stale");

/**
 * Lazily computed value kept until invalidated. Falsy values are cached too.
 *
 * @example
 * cache.ensure(load); // computes
 * cache.ensure(load); // cached
 * cache.invalidate();
 * cache.ensure(load); // computes again
 */
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
