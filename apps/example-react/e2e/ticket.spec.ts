import { expect, type Page, test } from "@playwright/test";

const columnCards = (page: Page, column: string) =>
	page.locator("section", { has: page.locator("h3", { hasText: column }) }).locator("article");

const addTicket = async (page: Page) => {
	await page.goto("/");
	await page
		.locator("section", { has: page.locator("h3", { hasText: "To Do" }) })
		.getByRole("button", { name: "+" })
		.click();

	return { dialog: page.locator("dialog"), card: columnCards(page, "To Do") };
};

test.describe("TicketModal", () => {
	test("should open a ticket from its card", async ({ page }) => {
		const { dialog } = await addTicket(page);

		await page.getByRole("link", { name: "todo" }).click();

		await expect(dialog).toBeVisible();
		await expect(dialog.getByRole("textbox", { name: "Title" })).toHaveValue("todo");
		await expect(page).toHaveURL(/\/tickets\/[^/]+$/);
	});

	test("should close the ticket with Escape", async ({ page }) => {
		const { dialog } = await addTicket(page);

		await page.getByRole("link", { name: "todo" }).click();
		await expect(dialog).toBeVisible();
		await page.keyboard.press("Escape");

		await expect(dialog).toBeHidden();
		await expect(page).toHaveURL(/\/$/);
	});

	test("should close the ticket by clicking the backdrop", async ({ page }) => {
		const { dialog } = await addTicket(page);

		await page.getByRole("link", { name: "todo" }).click();
		await expect(dialog).toBeVisible();
		await page.mouse.click(5, 5);

		await expect(dialog).toBeHidden();
	});

	test("should stay open when a text selection ends on the backdrop", async ({ page }) => {
		const { dialog } = await addTicket(page);

		await page.getByRole("link", { name: "todo" }).click();
		const box = await dialog.getByRole("textbox", { name: "Title" }).boundingBox();

		if (!box) throw new Error("Title input is not rendered");

		await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
		await page.mouse.down();
		await page.mouse.move(2, 2);
		await page.mouse.up();

		await expect(dialog).toBeVisible();
		await expect(page).toHaveURL(/\/tickets\/[^/]+$/);
	});

	test("should reopen the ticket after a reload", async ({ page }) => {
		const { dialog } = await addTicket(page);

		await page.getByRole("link", { name: "todo" }).click();
		await expect(dialog).toBeVisible();
		await page.reload();

		await expect(dialog).toBeVisible();
		await expect(dialog.getByRole("textbox", { name: "Title" })).toHaveValue("todo");
	});

	test("should report an unknown ticket", async ({ page }) => {
		await page.goto("/tickets/missing");

		await expect(page.locator("dialog")).toContainText("Ticket not found");
	});

	test("should open a ticket from the backlog", async ({ page }) => {
		const { dialog } = await addTicket(page);

		await page.getByRole("link", { name: "Backlog" }).click();
		await page.getByRole("link", { name: "todo" }).click();

		await expect(dialog).toBeVisible();
		await expect(page).toHaveURL(/\/backlog\/tickets\/[^/]+$/);
	});
});

test.describe("TicketModal editing", () => {
	const openTicket = async (page: Page) => {
		const result = await addTicket(page);

		await page.getByRole("link", { name: "todo" }).click();
		await expect(result.dialog).toBeVisible();

		return result;
	};

	test("should rename the ticket only after saving", async ({ page }) => {
		const { dialog, card } = await openTicket(page);

		await dialog.getByRole("textbox", { name: "Title" }).fill("Renamed");

		await expect(card).toHaveText(/todo/);

		await page.keyboard.press("Enter");

		await expect(card).toHaveText(/Renamed/);
		await expect(dialog).toBeVisible();
	});

	test("should save every field in one submit", async ({ page }) => {
		const { dialog } = await openTicket(page);

		await dialog.getByRole("textbox", { name: "Title" }).fill("Renamed");
		await dialog.getByRole("textbox", { name: "Description" }).fill("Line one");
		await dialog.getByRole("combobox", { name: "Status" }).selectOption("done");
		await dialog.getByRole("textbox", { name: "Name" }).fill("Ann");
		await dialog.getByRole("textbox", { name: "Email" }).fill("ann@example.com");

		await expect(columnCards(page, "To Do")).toHaveCount(1);

		await dialog.getByRole("button", { name: "Save" }).click();

		const card = columnCards(page, "Done");

		await expect(columnCards(page, "To Do")).toHaveCount(0);
		await expect(card).toHaveText(/Renamed/);
		await expect(card).toHaveText(/Line one/);
		await expect(card).toHaveText(/Ann/);
		await expect(dialog).toBeVisible();
	});

	test("should not save an empty title", async ({ page }) => {
		const { dialog, card } = await openTicket(page);
		const title = dialog.getByRole("textbox", { name: "Title" });

		await title.fill("   ");
		await dialog.getByRole("button", { name: "Save" }).click();

		await expect(title).toBeFocused();
		await expect(card).toHaveText(/todo/);
	});

	test("should keep saved values after a reload", async ({ page }) => {
		const { dialog, card } = await openTicket(page);

		await dialog.getByRole("textbox", { name: "Title" }).fill("Renamed");
		await page.keyboard.press("Enter");
		await expect(card).toHaveText(/Renamed/);
		await page.reload();

		await expect(dialog.getByRole("textbox", { name: "Title" })).toHaveValue("Renamed");
	});
});
