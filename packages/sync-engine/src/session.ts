import type { Delegatable } from "@nn/observable";
import { Observable } from "@nn/observable/observable";

export enum SessionState {
	Idle = "idle",
	Connecting = "connecting",
	Connected = "connected",
	Disconnected = "disconnected",
	Disposed = "disposed",
}

export enum SessionEvent {
	Connect = "connect",
	Succeed = "succeed",
	Fail = "fail",
	Drop = "drop",
	Reopen = "reopen",
	Retry = "retry",
	Dispose = "dispose",
}

export interface SessionDelegate {
	sessionOpen(session: Session, signal: AbortSignal): Promise<void>;
	sessionClose(session: Session): void;
	sessionDidConnect(session: Session): void;
}

export class Session implements Delegatable<SessionDelegate> {
	public readonly changes = new Observable<[SessionState]>();
	public delegate?: SessionDelegate;
	private queue: SessionEvent[] = [];
	private currentState = SessionState.Idle;
	private controller?: AbortController;

	public get state(): SessionState {
		return this.currentState;
	}

	public get idle(): boolean {
		return this.currentState === SessionState.Idle;
	}

	public get connecting(): boolean {
		return this.currentState === SessionState.Connecting;
	}

	public get connected(): boolean {
		return this.currentState === SessionState.Connected;
	}

	public get disconnected(): boolean {
		return this.currentState === SessionState.Disconnected;
	}

	public get disposed(): boolean {
		return this.currentState === SessionState.Disposed;
	}

	public connect(): void {
		this.dispatch(SessionEvent.Connect);
	}

	public dispose(): void {
		this.dispatch(SessionEvent.Dispose);
	}

	public drop(): void {
		this.dispatch(SessionEvent.Drop);
	}

	public reopen(): void {
		this.dispatch(SessionEvent.Reopen);
	}

	public retry(): void {
		this.dispatch(SessionEvent.Retry);
	}

	private open(): void {
		const controller = new AbortController();

		this.controller = controller;

		Promise.resolve(this.delegate?.sessionOpen(this, controller.signal))
			.then(() => controller.signal.aborted || this.dispatch(SessionEvent.Succeed))
			.catch(() => controller.signal.aborted || this.dispatch(SessionEvent.Fail));
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
							case SessionState.Connecting:
								this.close();
								this.open();
								break;
							case SessionState.Connected:
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

	public static transition(state: SessionState, event: SessionEvent): SessionState {
		if (state === SessionState.Disposed) return state;

		if (event === SessionEvent.Dispose) return SessionState.Disposed;

		switch (state) {
			case SessionState.Idle:
				return event === SessionEvent.Connect ? SessionState.Connecting : state;
			case SessionState.Connecting:
				if (event === SessionEvent.Succeed) return SessionState.Connected;

				if (event === SessionEvent.Fail || event === SessionEvent.Drop) return SessionState.Disconnected;

				return state;
			case SessionState.Connected:
				if (event === SessionEvent.Drop) return SessionState.Disconnected;

				if (event === SessionEvent.Reopen) return SessionState.Connecting;

				return state;
			case SessionState.Disconnected:
				return event === SessionEvent.Retry ? SessionState.Connecting : state;
		}
	}
}
