import { Observable, type Unsubscribe } from "@nn/observable/observable";

import type { Replica } from "./replica";
import { Session, type SessionState } from "./session";

export abstract class SyncEngine {
	protected readonly session: Session = new Session();
	protected readonly errors: Observable<[unknown]> = new Observable();
	protected readonly replica: Replica;

	constructor(replica: Replica) {
		this.replica = replica;

		let unsubscribeFromReplicaChanges: () => void | undefined;

		this.session.delegate = {
			sessionOpen: async (_session, signal) => {
				try {
					await this.open(signal);

					if (!signal.aborted && this.pull) {
						for (const name in this.replica.schema.properties) {
							const value = await this.pull(name);

							if (signal.aborted) break;

							if (value) this.replica.merge(name, value);
						}
					}
				} catch (error) {
					if (!signal.aborted) {
						this.errors.notify(error);
						this.session.drop();
					}
				}
			},
			sessionDidConnect: () => {
				void this.send(this.replica.encode().data);

				unsubscribeFromReplicaChanges = this.replica.onChange((changes) => void this.send(changes));
			},
			sessionClose: () => {
				unsubscribeFromReplicaChanges?.();
				this.close();
			},
		};
	}

	public get state(): SessionState {
		return this.session.state;
	}

	public get idle(): boolean {
		return this.session.idle;
	}

	public get connecting(): boolean {
		return this.session.connecting;
	}

	public get connected(): boolean {
		return this.session.connected;
	}

	public get disconnected(): boolean {
		return this.session.disconnected;
	}

	public get disposed(): boolean {
		return this.session.disposed;
	}

	public connect(): void {
		this.session.connect();
	}

	public retry(): void {
		this.session.retry();
	}

	public dispose(): void {
		this.session.dispose();
	}

	public onStateChange(listener: (state: SessionState) => void): Unsubscribe {
		return this.session.changes.subscribe(listener);
	}

	public onError(listener: (error: unknown) => void): Unsubscribe {
		return this.errors.subscribe(listener);
	}

	protected abstract open(signal: AbortSignal): Promise<void>;
	protected abstract close(): void;
	protected pull?(name: string): Promise<unknown>;
	protected abstract push(name: string, entry: unknown): Promise<void>;

	protected receive(entries: Record<string, unknown>): void {
		for (const name in this.replica.schema.properties) {
			if (Object.hasOwn(entries, name)) {
				this.replica.merge(name, entries[name]);
			}
		}
	}

	private async send(entries: Readonly<Record<string, unknown>>): Promise<void> {
		await Promise.all(
			Object.entries(entries).map(async ([name, entry]) => {
				try {
					await this.push(name, entry);
				} catch (error) {
					this.errors.notify(error);
				}
			}),
		);
	}
}
