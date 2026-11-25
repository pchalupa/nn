import { Theme } from "@radix-ui/themes";
import { render, screen } from "@testing-library/react";
import { I18nextProvider } from "react-i18next";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { clearSession, setSession } from "@/features/authentication/session";
import { i18n } from "@/i18n";
import { store } from "@/store";

import { Identity } from ".";

describe("Identity", () => {
	beforeEach(() => {
		setSession("ann");
		store.mutate((data) => {
			data.users = [{ id: "ann", name: "Ann", passkeys: [] }];
			data.boards = [
				{
					id: "nn",
					name: "nn",
					description: "",
					tickets: [
						{
							id: "t1",
							title: "Mine",
							description: "",
							status: "todo",
							priority: "low",
							assignee: "ann",
							labels: [],
							comments: [{ id: "c1", author: "ann", createdAt: "2026-01-01T00:00:00.000Z", body: "Hi" }],
							links: [],
						},
					],
				},
			];
		});
	});

	afterEach(() => clearSession());

	it("shows the assigned count and no comment count", () => {
		render(
			<I18nextProvider i18n={i18n}>
				<Theme>
					<Identity />
				</Theme>
			</I18nextProvider>,
		);

		expect(screen.getByText("assigned", { exact: false }).textContent).toBe("1 assigned");
		expect(screen.queryByText(/comment/)).toBeNull();
	});
});
