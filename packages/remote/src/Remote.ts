import type { Observable, Unsubscribe } from "@nn/event-emitter/Observable";

export interface RemoteDelegate {
	remoteDidUpdate(remote: Remote): void;
}

export interface Remote extends Observable<RemoteDelegate> {
	pull: () => Promise<unknown>;
	push: (data: unknown) => Promise<void>;
	connect: () => Unsubscribe;
}
