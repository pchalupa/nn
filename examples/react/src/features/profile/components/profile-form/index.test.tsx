import { Theme } from "@radix-ui/themes";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Suspense } from "react";
import { I18nextProvider } from "react-i18next";
import { afterEach, beforeAll, describe, expect, it } from "vitest";

import { setSession, clearSession } from "@/features/authentication/session";
import { i18n } from "@/i18n";
import { store } from "@/store";

import { ProfileForm } from ".";

describe("ProfileForm", () => {
	const user = userEvent.setup();

	beforeAll(() => {
		globalThis.ResizeObserver = class {
			public observe() {}

			public unobserve() {}

			public disconnect() {}
		};
	});

	afterEach(() => {
		clearSession();
	});

	it("rejects a blank name with an error on the field", async () => {
		store.mutate((data) => {
			data.users = [{ id: "ann", name: "Ann", passkeys: [] }];
		});
		setSession("ann");

		await act(async () =>
			render(
				<I18nextProvider i18n={i18n}>
					<Theme>
						<Suspense fallback="fallback">
							<ProfileForm />
						</Suspense>
					</Theme>
				</I18nextProvider>,
			),
		);

		const name = await screen.findByRole("textbox", { name: "Name" });

		await user.clear(name);
		await user.type(name, "   ");
		await user.click(screen.getByRole("button", { name: "Save changes" }));

		expect(name.getAttribute("aria-describedby")).toContain(
			screen.getByText("Shown on tickets and comments you write.").id,
		);
		expect(name.getAttribute("aria-invalid")).toBe("true");
		expect(screen.getByText("Enter a name.").id).not.toBe("");
		expect(name.getAttribute("aria-describedby")).toContain(screen.getByText("Enter a name.").id);
		expect(store.query((data) => data.users[0]?.name)).toBe("Ann");
	});
});
