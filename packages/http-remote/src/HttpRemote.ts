import { EventEmitter } from "@nn/event-emitter";
import type { Remote } from "@nn/remote";

export class HttpRemote implements Remote {
	public events = new EventEmitter<{ update: [] }>();
	private url: URL;

	constructor(url: string) {
		this.url = new URL(url);
	}

	private async request<ResponseData>(method: "GET" | "POST", path: string, body?: unknown): Promise<ResponseData> {
		const url = new URL(path, this.url);
		const headers = new Headers({
			"Content-Type": "application/json",
			Accept: "application/json",
		});
		const response = await fetch(url, {
			method: method,
			headers: headers,
			body: JSON.stringify(body),
		});

		if (!response.ok) {
			throw new Error(`Failed to fetch data from ${this.url}`);
		}

		return response.json();
	}

	async pull(): Promise<Record<string, unknown>> {
		const response = await this.request<Record<string, unknown>>("GET", "/pull");

		return response;
	}

	async push(data: unknown): Promise<void> {
		await this.request<Record<string, unknown>>("POST", "/push", data);
	}

	subscribe(): () => void {
		const url = new URL("/subscribe", this.url);
		const eventSource = new EventSource(url);

		const handleMessage = (event: MessageEvent) => {
			this.events.emit("update");
		};

		eventSource.addEventListener("message", handleMessage);

		return () => {
			eventSource.removeEventListener("message", handleMessage);
			eventSource.close();
		};
	}
}
