export class Reference<Value extends object> {
	constructor(public resolve: () => Value | undefined) {}

	static createReferenceFor<Type extends object>(dataAccessor: () => Type | undefined): Reference<Type> & Type {
		const reference = new Reference<Type>(dataAccessor);

		const proxy = new Proxy(reference, {
			get(target, prop, receiver) {
				// TODO: Consider adding a cache to avoid calling the accessor multiple times
				const data = target.resolve();

				if (data) return Reflect.get(data, prop, receiver);
			},
		});

		// TODO: Avoid type casting
		return proxy as Reference<Type> & Type;
	}
}
