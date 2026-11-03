import Cookies from "js-cookie";

const KEY = "nn-current-user";

const session = Cookies.withAttributes({ expires: 365, sameSite: "strict" });

export function setUser(userId: string): void {
	session.set(KEY, userId);
}

export function signOut(): void {
	session.remove(KEY);
}

export function authenticated(): boolean {
	return session.get(KEY) !== undefined;
}
