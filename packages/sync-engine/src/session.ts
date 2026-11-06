import type { Delegatable } from "@nn/observable";
import { Observable } from "@nn/observable/observable";

export enum SessionState {
	Idle = "idle",
	Connecting = "connecting",
	Connected = "connected",
	Disconnected = "disconnected",
	Detached = "detached",
}

export enum SessionEvent {
	Connect = "connect",
	Succeed = "succeed",
	Fail = "fail",
	Drop = "drop",
	Reconnect = "reconnect",
	Retry = "retry",
	Detach = "detach",
}

export interface SessionDelegate {
	sessionOpen(session: Session, signal: AbortSignal): Promise<void>;
	sessionDidOpen(session: Session): void;
	sessionDidClose(session: Session): void;
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

	public get detached(): boolean {
		return this.currentState === SessionState.Detached;
	}

	public connect(): void {
		this.dispatch(SessionEvent.Connect);
	}

	public detach(): void {
		this.dispatch(SessionEvent.Detach);
	}

	public drop(): void {
		this.dispatch(SessionEvent.Drop);
	}

	public reconnect(): void {
		this.dispatch(SessionEvent.Reconnect);
	}

	public retry(): void {
		this.dispatch(SessionEvent.Retry);
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
								this.delegate?.sessionDidOpen(this);
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
			this.delegate?.sessionDidClose(this);
		}
	}

	public static transition(state: SessionState, event: SessionEvent): SessionState {
		if (state === SessionState.Detached) return state;

		if (event === SessionEvent.Detach) return SessionState.Detached;

		switch (state) {
			case SessionState.Idle:
				return event === SessionEvent.Connect ? SessionState.Connecting : state;
			case SessionState.Connecting:
				if (event === SessionEvent.Succeed) return SessionState.Connected;

				if (event === SessionEvent.Fail || event === SessionEvent.Drop) return SessionState.Disconnected;

				return state;
			case SessionState.Connected:
				if (event === SessionEvent.Drop) return SessionState.Disconnected;

				if (event === SessionEvent.Reconnect) return SessionState.Connecting;

				return state;
			case SessionState.Disconnected:
				return event === SessionEvent.Retry ? SessionState.Connecting : state;
		}
	}
}
