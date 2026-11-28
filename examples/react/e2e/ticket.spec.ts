import { createBoard, expect, openBoard, type Page, test } from "./fixtures";

const columnCards = (page: Page, column: string) =>
	page.getByRole("region", { name: column, includeHidden: true }).getByRole("listitem", { includeHidden: true });

const newTicket = (page: Page) => page.getByRole("button", { name: "New ticket", exact: true });

const addTicket = async (page: Page) => {
	const dialog = page.getByRole("dialog");

	await createBoard(page, "Goodstate");
	await newTicket(page).click();
	await dialog.getByRole("textbox", { name: "Title" }).fill("todo");
	await dialog.getByRole("button", { name: "Create ticket" }).click();
	await expect(dialog).toBeHidden();

	return { dialog, card: columnCards(page, "Backlog") };
};

test.describe("TicketModal editing", () => {
	const openTicket = async (page: Page) => {
		const result = await addTicket(page);

		await page.getByRole("link", { name: "todo" }).click();
		await expect(result.dialog).toBeVisible();

		return result;
	};

	test("should keep saved values after a reload", async ({ page }) => {
		const { dialog, card } = await openTicket(page);

		await dialog.getByRole("textbox", { name: "Title" }).fill("Renamed");
		await page.keyboard.press("Escape");
		await expect(dialog).toBeHidden();
		await expect(card).toHaveText(/Renamed/);
		await page.reload();

		await expect(card).toHaveText(/Renamed/);
	});

	test("edits labels from the card", async ({ page }) => {
		const { dialog, card } = await openTicket(page);

		await dialog.getByRole("textbox", { name: "Labels" }).fill("bug");
		await page.keyboard.press("Enter");

		await expect(card).toHaveText(/bug/);

		await page.keyboard.press("Escape");
		await expect(dialog).toBeHidden();
		await page.reload();

		await expect(card).toHaveText(/bug/);
	});

	test("adds a link to a ticket and keeps it after a reload", async ({ page }) => {
		const { dialog, card } = await openTicket(page);

		await dialog.getByRole("textbox", { name: "Links" }).fill("https://github.com/pchalupa/goodstate/pull/212");
		await page.keyboard.press("Enter");
		await dialog.getByRole("button", { name: "Close" }).last().click();
		await expect(dialog).toBeHidden();

		await page.reload();
		await card.getByRole("link").click();

		await expect(dialog.getByRole("link", { name: "PR #212" })).toHaveAttribute(
			"href",
			"https://github.com/pchalupa/goodstate/pull/212",
		);
	});
});

test.describe("TicketModal deleting", () => {
	const confirmDelete = async (page: Page) => {
		await page.getByRole("dialog").getByRole("button", { name: "Delete" }).click();
		await page.getByRole("alertdialog").getByRole("button", { name: "Delete" }).click();
	};

	test("should keep the ticket deleted after a reload", async ({ page }) => {
		const { card } = await addTicket(page);

		await page.getByRole("link", { name: "todo" }).click();
		await confirmDelete(page);
		await expect(card).toHaveCount(0);
		await page.reload();

		await expect(newTicket(page)).toBeVisible();
		await expect(card).toHaveCount(0);
	});

	test("should delete the ticket in another tab", async ({ page }) => {
		const { card } = await addTicket(page);
		const other = await page.context().newPage();

		await openBoard(other, "Goodstate");
		await expect(columnCards(other, "Backlog")).toHaveCount(1);

		await page.getByRole("link", { name: "todo" }).click();
		await confirmDelete(page);
		await expect(card).toHaveCount(0);

		await expect(columnCards(other, "Backlog")).toHaveCount(0);
		await other.reload();
		await expect(newTicket(other)).toBeVisible();
		await expect(columnCards(other, "Backlog")).toHaveCount(0);
	});
});
