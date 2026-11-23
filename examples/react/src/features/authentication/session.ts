import Cookies from "js-cookie";

const KEY = "nn-current-user";

const session = Cookies.withAttributes({ expires: 365, sameSite: "strict" });

export function setSession(userId: string): void {
	session.set(KEY, userId);
}

/** Returns the id of the signed-in user. */
export function getSession(): string | undefined {
	return session.get(KEY);
}

export function clearSession(): void {
	session.remove(KEY);
}
