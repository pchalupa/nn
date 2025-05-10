export class Remote {
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

	async pull() {
		const response = await this.request<Record<string, unknown>>("GET", "/pull");

		return response;
	}

	async push(data: unknown) {
		await this.request<Record<string, unknown>>("POST", "/push", data);
	}

	subscribe() {}
}
