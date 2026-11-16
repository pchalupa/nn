import { expect, type Page, test } from "./fixtures";

const createTicket = async (page: Page, title: string, assignToMe: boolean) => {
	const dialog = page.locator("dialog");

	await page.getByRole("button", { name: "New ticket" }).first().click();
	await dialog.getByRole("textbox", { name: "Title" }).fill(title);

	if (assignToMe) await dialog.getByRole("combobox", { name: "Assignee" }).selectOption({ label: "Jan Novak" });

	await dialog.getByRole("button", { name: /Save/ }).click();
	await expect(dialog).toBeHidden();
};

test.describe("Filters", () => {
	test("assigned to me hides other tickets and survives a reload", async ({ page }) => {
		await page.goto("/");
		await createTicket(page, "Mine", true);
		await createTicket(page, "Nobody's", false);

		const assignedToMe = page.getByRole("button", { name: /Assigned to me/ });
		const cards = page.getByRole("article");

		await assignedToMe.click();

		await expect(assignedToMe).toHaveAttribute("aria-pressed", "true");
		await expect(cards).toHaveCount(1);
		await expect(cards).toHaveText(/Mine/);

		await page.reload();

		await expect(assignedToMe).toHaveAttribute("aria-pressed", "true");
		await expect(cards).toHaveCount(1);

		await page.getByRole("button", { name: /^Board/ }).click();

		await expect(cards).toHaveCount(2);
	});
});
