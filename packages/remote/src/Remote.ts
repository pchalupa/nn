import type { Observable } from "@nn/observable";

export interface RemoteDelegate {
	remoteDidUpdate(remote: Remote): void;
}

export interface Remote extends Observable<RemoteDelegate> {
	pull: () => Promise<unknown>;
	push: (data: unknown) => Promise<void>;
	connect: () => () => void;
}
