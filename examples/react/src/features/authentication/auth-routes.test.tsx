import { Theme } from "@radix-ui/themes";
import {
	createMemoryHistory,
	createRootRoute,
	createRouter,
	RouterProvider,
	type RouteComponent,
} from "@tanstack/react-router";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Suspense } from "react";
import { I18nextProvider } from "react-i18next";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { i18n } from "@/i18n";
import { Route as SignInRoute } from "@/routes/sign-in";
import { Route as SignUpRoute } from "@/routes/sign-up";

import { signIn, signUp } from "./authentication";

vi.mock("./authentication", () => ({ signIn: vi.fn(), signUp: vi.fn() }));

const renderPage = async (component: RouteComponent | undefined) => {
	const router = createRouter({ routeTree: createRootRoute({ component }), history: createMemoryHistory() });

	await act(async () =>
		render(
			<I18nextProvider i18n={i18n}>
				<Theme>
					<Suspense fallback="fallback">
						<RouterProvider router={router} />
					</Suspense>
				</Theme>
			</I18nextProvider>,
		),
	);
};

describe("auth routes", () => {
	const user = userEvent.setup();

	beforeEach(() => {
		vi.mocked(signIn).mockReset();
		vi.mocked(signUp).mockReset();
	});

	it("rejects a blank sign-up name with an error on the field", async () => {
		await renderPage(SignUpRoute.options.component);

		const name = await screen.findByRole("textbox", { name: "Name" });

		await user.type(name, "   ");
		await user.click(screen.getByRole("button", { name: "Continue with passkey" }));

		expect(signUp).not.toHaveBeenCalled();
		expect(name.getAttribute("aria-invalid")).toBe("true");
		expect(name.getAttribute("aria-describedby")).toContain(screen.getByText("Enter a name.").id);
	});

	it("announces a failed sign-up", async () => {
		vi.mocked(signUp).mockRejectedValue(new Error("cancelled"));
		await renderPage(SignUpRoute.options.component);

		await user.type(await screen.findByRole("textbox", { name: "Name" }), "Ann");
		await user.click(screen.getByRole("button", { name: "Continue with passkey" }));

		expect((await screen.findByRole("alert")).textContent).toBe("Couldn't verify your passkey. Try again.");
	});

	it("announces a failed sign-in", async () => {
		vi.mocked(signIn).mockRejectedValue(new Error("cancelled"));
		await renderPage(SignInRoute.options.component);

		await user.click(await screen.findByRole("button", { name: "Continue with passkey" }));

		expect((await screen.findByRole("alert")).textContent).toBe("Couldn't verify your passkey. Try again.");
	});

	it("renders one level-one heading per page", async () => {
		await renderPage(SignInRoute.options.component);

		expect((await screen.findAllByRole("heading", { level: 1 })).map((heading) => heading.textContent)).toStrictEqual([
			"Sign in",
		]);
	});
});
