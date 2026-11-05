import type { Delegatable } from "@nn/observable";

export interface EventStreamDelegate {
	eventStreamDidReceive(data: unknown): void;
	eventStreamDidFail(error: unknown): void;
	eventStreamDidClose(): void;
}

export class EventStream implements Delegatable<EventStreamDelegate> {
	public delegate?: EventStreamDelegate;
	private eventSource?: EventSource;

	constructor(private readonly url: URL) {}

	public async open(signal: AbortSignal): Promise<void> {
		const eventSource = (this.eventSource = new EventSource(this.url));

		await new Promise<void>((resolve, reject) => {
			signal.addEventListener("abort", () => reject(signal.reason), { once: true });

			eventSource.onmessage = (event) => {
				try {
					this.delegate?.eventStreamDidReceive(event.data);
					resolve();
				} catch (error) {
					reject(error);
				}
			};
			eventSource.onerror = () => {
				if (eventSource.readyState === EventSource.CLOSED) reject(new Error(`Failed to subscribe to ${this.url}`));
			};
		});

		eventSource.onmessage = (event) => {
			try {
				this.delegate?.eventStreamDidReceive(event.data);
			} catch (error) {
				this.delegate?.eventStreamDidFail(error);
			}
		};
		eventSource.onerror = () => {
			if (eventSource.readyState === EventSource.CLOSED) this.delegate?.eventStreamDidClose();
		};
	}

	public close(): void {
		this.eventSource?.close();
	}
}
