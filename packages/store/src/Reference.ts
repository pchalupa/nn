export class Reference<Type = unknown> {
	constructor(public resolve: () => Type) {}

	static createReferenceFor<Type extends object>(dataAccessor: () => Type) {
		const reference = new Reference<Type>(dataAccessor);

		const proxy = new Proxy(reference, {
			get(target, prop, receiver) {
				// TODO: Consider adding a cache to avoid calling the accessor multiple times
				const data = target.resolve();

				return Reflect.get(data, prop, receiver);
			},
		});

		// TODO: Avoid type casting
		return proxy as Reference<Type> & Type;
	}
}
