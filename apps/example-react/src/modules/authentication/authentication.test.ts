import {
	type AuthenticationResponseJSON,
	bufferToBase64URLString,
	type RegistrationResponseJSON,
	startAuthentication,
	startRegistration,
} from "@simplewebauthn/browser";
import { afterEach, describe, expect, it, vi } from "vitest";

import { signIn, signUp } from "./authentication";
import { authenticated, signOut } from "./session";

vi.mock(import("@simplewebauthn/browser"), async (importOriginal) => ({
	...(await importOriginal()),
	startAuthentication: vi.fn(),
	startRegistration: vi.fn(),
}));

const cancelled = new DOMException("cancelled", "NotAllowedError");

const account = {
	id: crypto.randomUUID(),
	name: "Ada",
	passkeys: [{ credentialId: "credential-1", publicKey: "public-key", algorithm: -7 }],
};

const registration: RegistrationResponseJSON = {
	id: "credential-1",
	rawId: "credential-1",
	response: { clientDataJSON: "", attestationObject: "", publicKey: "public-key", publicKeyAlgorithm: -7 },
	clientExtensionResults: {},
	type: "public-key",
};

const assertion: AuthenticationResponseJSON = {
	id: "credential-1",
	rawId: "credential-1",
	response: {
		clientDataJSON: "",
		authenticatorData: "",
		signature: "",
		userHandle: bufferToBase64URLString(new TextEncoder().encode(account.id).buffer),
	},
	clientExtensionResults: {},
	type: "public-key",
};

describe("authentication", () => {
	afterEach(() => {
		vi.mocked(startAuthentication).mockReset();
		vi.mocked(startRegistration).mockReset();
		signOut();
	});

	describe("signUp", () => {
		it("requests a discoverable passkey for the user", async () => {
			vi.mocked(startRegistration).mockRejectedValue(cancelled);

			await expect(signUp({ name: "Ada" })).rejects.toBe(cancelled);

			expect(startRegistration).toHaveBeenCalledExactlyOnceWith({
				optionsJSON: expect.objectContaining({
					rp: { id: "localhost", name: "DBug" },
					user: expect.objectContaining({ name: "Ada", displayName: "Ada" }),
					pubKeyCredParams: [
						{ type: "public-key", alg: -7 },
						{ type: "public-key", alg: -257 },
					],
					authenticatorSelection: { residentKey: "required", userVerification: "preferred" },
				}),
			});
		});

		it("returns the account with its passkey and signs in", async () => {
			vi.mocked(startRegistration).mockResolvedValue(registration);

			const created = await signUp({ name: "Ada" });
			const { user } = vi.mocked(startRegistration).mock.calls[0]?.[0].optionsJSON ?? {};

			expect(user?.id).toBe(bufferToBase64URLString(new TextEncoder().encode(created.id).buffer));
			expect(created).toStrictEqual({
				id: created.id,
				name: "Ada",
				passkeys: [{ credentialId: "credential-1", publicKey: "public-key", algorithm: -7 }],
			});
			expect(authenticated()).toBe(true);
		});

		it("throws when the response has no public key", async () => {
			vi.mocked(startRegistration).mockResolvedValue({
				...registration,
				response: { ...registration.response, publicKey: undefined },
			});

			await expect(signUp({ name: "Ada" })).rejects.toThrow("Missing public key");
			expect(authenticated()).toBe(false);
		});

		it("throws when sign-up is cancelled", async () => {
			vi.mocked(startRegistration).mockRejectedValue(cancelled);

			await expect(signUp({ name: "Ada" })).rejects.toBe(cancelled);
			expect(authenticated()).toBe(false);
		});
	});

	describe("signIn", () => {
		it("requests any passkey for this site", async () => {
			vi.mocked(startAuthentication).mockRejectedValue(cancelled);

			await expect(signIn([account])).rejects.toBe(cancelled);

			expect(startAuthentication).toHaveBeenCalledExactlyOnceWith({
				optionsJSON: expect.objectContaining({ rpId: "localhost", userVerification: "preferred" }),
			});
			expect(vi.mocked(startAuthentication).mock.calls[0]?.[0].optionsJSON).not.toHaveProperty("allowCredentials");
		});

		it("signs in the account that holds the passkey", async () => {
			vi.mocked(startAuthentication).mockResolvedValue(assertion);

			await signIn([account]);

			expect(authenticated()).toBe(true);
		});

		it("throws for an account that is not on this device", async () => {
			vi.mocked(startAuthentication).mockResolvedValue(assertion);

			await expect(signIn([{ ...account, id: crypto.randomUUID() }])).rejects.toBeInstanceOf(Error);
			expect(authenticated()).toBe(false);
		});

		it("throws when the passkey is not one of the account's passkeys", async () => {
			vi.mocked(startAuthentication).mockResolvedValue(assertion);

			await expect(signIn([{ ...account, passkeys: [{ credentialId: "credential-2" }] }])).rejects.toThrow("Unknown passkey");
			expect(authenticated()).toBe(false);
		});

		it("throws when the passkey prompt is cancelled", async () => {
			vi.mocked(startAuthentication).mockRejectedValue(cancelled);

			await expect(signIn([account])).rejects.toBe(cancelled);
			expect(authenticated()).toBe(false);
		});
	});
});
