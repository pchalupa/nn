import type { Delegatable } from "@nn/observable";
import { Observable } from "@nn/observable/observable";

/** Connection state of a sync engine, see `Session.transition` for how it changes */
export type SessionState = "idle" | "connecting" | "connected" | "disconnected" | "disposed";

export type SessionEvent = "connect" | "succeed" | "fail" | "drop" | "reopen" | "retry" | "dispose";

export interface SessionDelegate {
	sessionOpen(session: Session, signal: AbortSignal): Promise<void>;
	sessionClose(session: Session): void;
	sessionDidConnect(session: Session): void;
}

/**
 * Connection state machine of a `SyncEngine`. Events that don't apply to the current state are ignored, and events
 * dispatched during a state change are queued.
 */
export class Session implements Delegatable<SessionDelegate> {
	public readonly changes: Observable<[SessionState]> = new Observable();
	public delegate?: SessionDelegate;
	private queue: SessionEvent[] = [];
	private currentState: SessionState = "idle";
	private controller?: AbortController;

	public get state(): SessionState {
		return this.currentState;
	}

	public get idle(): boolean {
		return this.currentState === "idle";
	}

	public get connecting(): boolean {
		return this.currentState === "connecting";
	}

	public get connected(): boolean {
		return this.currentState === "connected";
	}

	public get disconnected(): boolean {
		return this.currentState === "disconnected";
	}

	public get disposed(): boolean {
		return this.currentState === "disposed";
	}

	public connect(): void {
		this.dispatch("connect");
	}

	public dispose(): void {
		this.dispatch("dispose");
	}

	public drop(): void {
		this.dispatch("drop");
	}

	public reopen(): void {
		this.dispatch("reopen");
	}

	public retry(): void {
		this.dispatch("retry");
	}

	private open(): void {
		const controller = new AbortController();

		this.controller = controller;

		Promise.resolve(this.delegate?.sessionOpen(this, controller.signal))
			.then(() => controller.signal.aborted || this.dispatch("succeed"))
			.catch(() => controller.signal.aborted || this.dispatch("fail"));
	}

	private close(): void {
		if (this.controller) {
			this.controller.abort();
			this.controller = undefined;
			this.delegate?.sessionClose(this);
		}
	}

	private dispatch(event: SessionEvent): void {
		this.queue.push(event);

		if (this.queue.length <= 1) {
			try {
				for (const next of this.queue) {
					const from = this.state;
					const to = Session.transition(from, next);

					if (to !== from) {
						this.currentState = to;

						switch (to) {
							case "connecting":
								this.close();
								this.open();
								break;
							case "connected":
								this.delegate?.sessionDidConnect(this);
								break;
							default:
								this.close();
						}

						this.changes.notify(to);
					}
				}
			} finally {
				this.queue.length = 0;
			}
		}
	}

	/**
	 * ```text
	 * idle         --connect-->   connecting
	 * connecting   --succeed-->   connected
	 * connecting   --fail/drop--> disconnected
	 * connected    --drop-->      disconnected
	 * connected    --reopen-->    connecting
	 * disconnected --retry-->     connecting
	 * any          --dispose-->   disposed (final)
	 * ```
	 */
	public static transition(state: SessionState, event: SessionEvent): SessionState {
		if (state === "disposed") return state;

		if (event === "dispose") return "disposed";

		switch (state) {
			case "idle":
				return event === "connect" ? "connecting" : state;
			case "connecting":
				if (event === "succeed") return "connected";

				if (event === "fail" || event === "drop") return "disconnected";

				return state;
			case "connected":
				if (event === "drop") return "disconnected";

				if (event === "reopen") return "connecting";

				return state;
			case "disconnected":
				return event === "retry" ? "connecting" : state;
		}
	}
}
