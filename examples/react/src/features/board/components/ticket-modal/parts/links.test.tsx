import { Theme } from "@radix-ui/themes";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Link } from "example-schema";
import { I18nextProvider } from "react-i18next";
import { describe, expect, it, vi } from "vitest";

import { i18n } from "@/i18n";

import { Links } from "./links";

const pullRequest = "https://github.com/pchalupa/nn/pull/212";

describe("Links", () => {
	const user = userEvent.setup();

	const renderLinks = async (links: Link[] = []) => {
		const onAdd = vi.fn<(link: Link) => void>();
		const onRemove = vi.fn<(id: string) => void>();

		await act(async () =>
			render(
				<I18nextProvider i18n={i18n}>
					<Theme>
						<Links links={links} onAdd={onAdd} onRemove={onRemove} />
					</Theme>
				</I18nextProvider>,
			),
		);

		return { onAdd, onRemove };
	};

	const input = () => screen.getByRole("textbox", { name: "Links" });

	it("adds a link on Enter", async () => {
		const { onAdd } = await renderLinks();

		await user.type(input(), `${pullRequest}{Enter}`);

		expect(onAdd).toHaveBeenCalledExactlyOnceWith({ id: expect.any(String), url: pullRequest, title: "PR #212" });
		expect(input()).toHaveProperty("value", "");
	});

	it("rejects a PR number", async () => {
		const { onAdd } = await renderLinks();

		await user.type(input(), "#212{Enter}");

		expect(screen.getByText("Enter a URL.")).toBeDefined();
		expect(onAdd).not.toHaveBeenCalled();
	});

	it("rejects input that is not a link", async () => {
		const { onAdd } = await renderLinks();

		await user.type(input(), "nope{Enter}");

		expect(screen.getByText("Enter a URL.")).toBeDefined();
		expect(input().getAttribute("aria-invalid")).toBe("true");
		expect(onAdd).not.toHaveBeenCalled();
	});

	it("shows a link that opens in a new tab", async () => {
		await renderLinks([{ id: "pr", url: pullRequest, title: "PR #212" }]);

		const link = screen.getByRole("link", { name: "PR #212" });

		expect(link.getAttribute("href")).toBe(pullRequest);
		expect(link.getAttribute("target")).toBe("_blank");
		expect(link.getAttribute("rel")).toBe("noreferrer");
		expect(screen.getByText("#212")).toBeDefined();
	});

	it("lists links above the input", async () => {
		await renderLinks([{ id: "pr", url: pullRequest, title: "PR #212" }]);

		const link = screen.getByRole("link", { name: "PR #212" });

		expect(link.compareDocumentPosition(input()) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
	});

	it("shows a stored link that is not a web URL as plain text", async () => {
		await renderLinks([
			{ id: "script", url: "javascript:alert(1)", title: "PR #212" },
			{ id: "ftp", url: "ftp://example.com/notes", title: "Notes" },
		]);

		expect(screen.queryAllByRole("link")).toStrictEqual([]);
		expect(screen.getByText("PR #212")).toBeDefined();
		expect(screen.getByText("Notes")).toBeDefined();
	});

	it("names a stored link without a title after its URL", async () => {
		await renderLinks([{ id: "pr", url: pullRequest, title: "" }]);

		expect(screen.getByRole("link", { name: "PR #212" })).toBeDefined();
		expect(screen.getByRole("button", { name: "Remove PR #212" })).toBeDefined();
	});

	it("removes a link", async () => {
		const { onRemove } = await renderLinks([{ id: "pr", url: pullRequest, title: "PR #212" }]);

		await user.click(screen.getByRole("button", { name: "Remove PR #212" }));

		expect(onRemove).toHaveBeenCalledExactlyOnceWith("pr");
	});
});
