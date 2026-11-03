import {
	base64URLStringToBuffer,
	bufferToBase64URLString,
	startAuthentication,
	startRegistration,
} from "@simplewebauthn/browser";

import { setUser } from "./session";

interface Passkey {
	credentialId: string;
	publicKey: string;
	algorithm: number;
}

interface Account {
	id: string;
	name: string;
	passkeys: Passkey[];
}

const createChallenge = () => crypto.getRandomValues(new Uint8Array(32));

export async function signUp({ name }: { name: string }): Promise<Account> {
	const id = crypto.randomUUID();
	const { id: credentialId, response } = await startRegistration({
		optionsJSON: {
			challenge: bufferToBase64URLString(createChallenge().buffer),
			rp: { id: location.hostname, name: "DBug" },
			user: {
				id: bufferToBase64URLString(new TextEncoder().encode(id).buffer),
				name,
				displayName: name,
			},
			pubKeyCredParams: [
				{ type: "public-key", alg: -7 },
				{ type: "public-key", alg: -257 },
			],
			authenticatorSelection: { residentKey: "required", userVerification: "preferred" },
		},
	});

	if (response.publicKey && response.publicKeyAlgorithm) {
		const passkey = { credentialId, publicKey: response.publicKey, algorithm: response.publicKeyAlgorithm };

		setUser(id);

		return { id, name, passkeys: [passkey] };
	}

	throw new Error("Missing public key");
}

export async function signIn(
	accounts: ReadonlyArray<{ id: string; passkeys: ReadonlyArray<{ credentialId: string }> }>,
): Promise<void> {
	const { id: credentialId, response } = await startAuthentication({
		optionsJSON: {
			challenge: bufferToBase64URLString(createChallenge().buffer),
			rpId: location.hostname,
			userVerification: "preferred",
		},
	});

	if (response.userHandle) {
		const userId = new TextDecoder().decode(base64URLStringToBuffer(response.userHandle));
		const account = accounts.find((candidate) => candidate.id === userId);

		if (account && account.passkeys.some((passkey) => passkey.credentialId === credentialId)) {
			setUser(account.id);
		} else throw new Error("Unknown passkey");
	}
}
