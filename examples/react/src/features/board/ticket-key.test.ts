import { describe, expect, it } from "vitest";

import { ticketKey } from "./ticket-key";

describe("ticketKey", () => {
	it("prefixes the first four characters of the id", () => {
		expect(ticketKey("a3f9c21e-0000-4000-8000-000000000000")).toBe("#a3f9");
	});
});
