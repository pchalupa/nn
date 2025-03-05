export class Reference<Value> {
	private constructor(public resolve: () => Value | undefined) {}

	static createReferenceFor<Value>(dataAccessor: () => Value | undefined): Reference<Value> & Value {
		const reference = new Reference<Value>(dataAccessor);

		const proxy = new Proxy(reference, {
			get(target, prop, receiver) {
				if (prop === "resolve") return Reflect.get(target, prop, receiver);
				// TODO: Consider adding a cache to avoid calling the accessor multiple times
				const data = target.resolve();

				if (data) return Reflect.get(data, prop, receiver);
			},
		});

		// TODO: Avoid type casting
		return proxy as Reference<Value> & Value;
	}
}
