import { createBoard, expect, test } from "./fixtures";

test.describe("Boards", () => {
	test("creates a board, adds a ticket and shows its progress", async ({ page }) => {
		const dialog = page.getByRole("dialog");

		await createBoard(page, "Q1 launch");
		await page.getByRole("button", { name: "New ticket", exact: true }).click();
		await dialog.getByRole("textbox", { name: "Title" }).fill("First");
		await dialog.getByRole("button", { name: "Create ticket" }).click();
		await expect(dialog).toBeHidden();

		await expect(page.getByRole("navigation").getByRole("link", { name: /^Boards/ })).toHaveCount(0);
		await page.goto("/");

		await expect(page.getByText("1 ticket", { exact: true })).toBeVisible();
		await expect(page.getByText("0% done")).toBeVisible();
	});

	test("renames and deletes a board from its menu", async ({ page }) => {
		await createBoard(page, "Keep");
		await createBoard(page, "Old");
		await page.goto("/");

		await page.getByRole("button", { name: "Actions for Old" }).click();
		await page.getByRole("menuitem", { name: "Rename" }).click();
		await page.getByRole("dialog").getByRole("textbox", { name: "Name" }).fill("New");
		await page.getByRole("dialog").getByRole("button", { name: "Save changes" }).click();
		await expect(page.getByRole("link", { name: "New", exact: true })).toBeVisible();

		await page.getByRole("button", { name: "Actions for New" }).click();
		await page.getByRole("menuitem", { name: "Delete" }).click();
		await page.getByRole("alertdialog").getByRole("button", { name: "Delete" }).click();
		await expect(page.getByRole("link", { name: "New", exact: true })).toHaveCount(0);

		await page.reload();

		await expect(page.getByRole("link", { name: "Keep", exact: true })).toBeVisible();
		await expect(page.getByRole("link", { name: "New", exact: true })).toHaveCount(0);
	});

	test("does not flash the empty boards list while boards load", async ({ page }) => {
		await createBoard(page, "Loaded");
		await page.goto("/");
		await page.addInitScript(() => {
			new MutationObserver(() => {
				if (document.body?.textContent?.includes("No boards yet")) sessionStorage.setItem("seen", "No boards yet");
			}).observe(document, { subtree: true, childList: true, characterData: true });
		});
		await page.reload();

		await expect(page.getByRole("link", { name: "Loaded", exact: true })).toBeVisible();
		expect(await page.evaluate(() => sessionStorage.getItem("seen"))).toBeNull();
	});

	test("shows the 404 page for an unknown URL", async ({ page }) => {
		await page.goto("/no-such-page");

		await expect(page.getByRole("heading", { level: 1, name: "Page not found" })).toBeVisible();
	});

	test("outlines a board card while its link has keyboard focus", async ({ page }) => {
		await createBoard(page, "Focus");
		await page.goto("/");

		const link = page.getByRole("link", { name: "Focus", exact: true });

		await expect(link).toBeVisible();
		await expect(async () => {
			await page.keyboard.press("Tab");
			await expect(link).toBeFocused({ timeout: 100 });
		}).toPass({ timeout: 5_000 });

		const card = page.locator(".board-card", { has: link });

		expect(await card.evaluate((element) => getComputedStyle(element).outlineStyle)).toBe("solid");
	});

	test("syncs a new board to another device", async ({ page, openDevice }) => {
		await createBoard(page, "Shared");

		const other = await openDevice({ passkeysFrom: page, signedIn: true });

		await expect(other.getByRole("link", { name: "Shared", exact: true })).toBeVisible();
	});
});
