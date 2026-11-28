import type { Delegatable } from "@goodstate/observable";

export interface LocalStorageDelegate {
	localStorageDidChange(name: string, entry: unknown): void;
	localStorageDidFail(error: unknown): void;
}

/** JSON entries stored under one name in `localStorage`. */
export class LocalStorage implements Delegatable<LocalStorageDelegate> {
	private readonly prefix: string;
	public delegate?: LocalStorageDelegate;

	constructor(name = "goodstate-default") {
		this.prefix = `${name}:`;
	}

	public get(name: string): unknown {
		const value = localStorage.getItem(this.prefix + name);

		if (value) return JSON.parse(value);
	}

	public set(name: string, entry: unknown): void {
		localStorage.setItem(this.prefix + name, JSON.stringify(entry));
	}

	/** Tells the delegate about entries other tabs write until `signal` aborts. */
	public listen(signal: AbortSignal): void {
		addEventListener(
			"storage",
			({ key, newValue: value, storageArea }) => {
				if (storageArea === localStorage && key && value && key.startsWith(this.prefix)) {
					try {
						const entry = JSON.parse(value);

						this.delegate?.localStorageDidChange(key.slice(this.prefix.length), entry);
					} catch (error) {
						this.delegate?.localStorageDidFail(error);

						return;
					}
				}
			},
			{ signal },
		);
	}
}
