import { afterEach, describe, expect, it } from "vitest";

import { authenticated, setUser, signOut } from "./session";

const userId = crypto.randomUUID();

describe("session", () => {
	afterEach(() => {
		signOut();
	});

	it("is not authenticated by default", () => {
		expect(authenticated()).toBe(false);
	});

	it("keeps the signed-in user in a cookie", () => {
		setUser(userId);

		expect(authenticated()).toBe(true);
		expect(document.cookie).toBe(`nn-current-user=${userId}`);
		expect(localStorage).toHaveLength(0);
	});

	it("signs out", () => {
		setUser(userId);

		signOut();

		expect(authenticated()).toBe(false);
		expect(document.cookie).toBe("");
	});
});
