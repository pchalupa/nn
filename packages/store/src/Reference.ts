export class Reference<T = unknown> {
	constructor(public getOriginalData: () => T) {}

	static createReferenceFor<T>(dataAccessor: () => T) {
		const reference = new Reference(dataAccessor);

		const proxy = new Proxy(reference, {
			get(target, prop, receiver) {
				if (prop === "getOriginalData") return Reflect.get(target, prop, receiver);

				// TODO: Consider adding a cache to avoid calling the accessor multiple times
				const data = target.getOriginalData();

				return Reflect.get(data, prop, receiver);
			},
		});

		return proxy;
	}
}
