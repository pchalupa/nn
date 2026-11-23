import Cookies from "js-cookie";

import { useQuery } from "../../store";

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

/** Returns the signed-in user's id and record. */
export function useUser() {
	const id = session.get(KEY);
	const user = useQuery((data) => data.users.find((entry) => entry.id === id));

	return user;
}
