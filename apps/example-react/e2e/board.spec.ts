import { expect, type Page, test } from "./fixtures";

const column = (page: Page, name: string) => page.getByRole("region", { name });

const createTicket = async (page: Page, title: string) => {
	const dialog = page.locator("dialog");

	await page.getByRole("button", { name: "New ticket C" }).click();
	await dialog.getByRole("textbox", { name: "Title" }).fill(title);
	await dialog.getByRole("button", { name: /Save changes/ }).click();
	await expect(dialog).toBeHidden();
};

test.describe("Board", () => {
	test("keeps a created ticket after a reload", async ({ page }) => {
		await page.goto("/");
		await createTicket(page, "Persisted");

		await expect(page.getByText("1 ticket", { exact: true })).toBeVisible();

		await page.reload();

		await expect(column(page, "To do").getByRole("article")).toHaveCount(1);
	});

	test("moves a card between columns", async ({ page }) => {
		await page.goto("/");
		await createTicket(page, "First");
		await createTicket(page, "Second");

		await page.getByRole("article").filter({ hasText: "Second" }).dragTo(column(page, "In progress"));

		await expect(column(page, "In progress").getByRole("article")).toHaveText(/Second/);

		await page.reload();

		await expect(column(page, "In progress").getByRole("article")).toHaveText(/Second/);
		await expect(column(page, "To do").getByRole("article")).toHaveText(/First/);
	});

	test("reorders cards within a column", async ({ page }) => {
		await page.goto("/");
		await createTicket(page, "First");
		await createTicket(page, "Second");

		const cards = column(page, "To do").getByRole("article");

		await cards.filter({ hasText: "Second" }).dragTo(cards.filter({ hasText: "First" }), {
			targetPosition: { x: 10, y: 2 },
		});

		await expect(cards.first()).toHaveText(/Second/);

		await page.reload();

		await expect(cards.first()).toHaveText(/Second/);
	});
});
