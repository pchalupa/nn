import { afterEach, describe, expect, it } from "vitest";

import { clearSession, getSession, setSession } from "./session";

const userId = crypto.randomUUID();

describe("session", () => {
	afterEach(() => {
		clearSession();
	});

	it("has no signed-in user by default", () => {
		expect(getSession()).toBeUndefined();
	});

	it("keeps the signed-in user in a cookie", () => {
		setSession(userId);

		expect(getSession()).toBe(userId);
		expect(document.cookie).toBe(`nn-current-user=${userId}`);
		expect(localStorage).toHaveLength(0);
	});

	it("signs out", () => {
		setSession(userId);

		clearSession();

		expect(getSession()).toBeUndefined();
		expect(document.cookie).toBe("");
	});

	it("returns the signed-in user id", () => {
		setSession(userId);

		expect(getSession()).toBe(userId);

		clearSession();

		expect(getSession()).toBeUndefined();
	});
});
