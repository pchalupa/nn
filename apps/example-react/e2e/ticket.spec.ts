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
		await expect(dialog).toContainText("todo");
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

	test("should close the ticket with the close button", async ({ page }) => {
		const { dialog } = await addTicket(page);

		await page.getByRole("link", { name: "todo" }).click();
		await dialog.getByRole("button", { name: "Close" }).click();

		await expect(dialog).toBeHidden();
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
		const title = dialog.getByRole("group", { name: "Title" });

		await title.getByRole("button").click();
		const box = await title.getByRole("textbox").boundingBox();

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
		await expect(dialog).toContainText("todo");
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

test.describe("TicketModal fields", () => {
	const openTicket = async (page: Page) => {
		const result = await addTicket(page);

		await page.getByRole("link", { name: "todo" }).click();
		await expect(result.dialog).toBeVisible();

		return result;
	};

	test("should rename the ticket only after submitting", async ({ page }) => {
		const { dialog, card } = await openTicket(page);
		const title = dialog.getByRole("group", { name: "Title" });

		await title.getByRole("button").click();
		await title.getByRole("textbox").fill("Renamed");

		await expect(card).toHaveText(/todo/);

		await page.keyboard.press("Enter");

		await expect(card).toHaveText(/Renamed/);
		await expect(dialog).toBeVisible();
	});

	test("should keep the dialog open when Escape cancels an edit", async ({ page }) => {
		const { dialog, card } = await openTicket(page);
		const title = dialog.getByRole("group", { name: "Title" });

		await title.getByRole("button").click();
		await title.getByRole("textbox").fill("Draft");
		await page.keyboard.press("Escape");

		await expect(dialog).toBeVisible();
		await expect(card).toHaveText(/todo/);
		await expect(title.getByRole("button")).toHaveText("todo");
	});

	test("should discard a title draft when another field is opened", async ({ page }) => {
		const { dialog, card } = await openTicket(page);
		const title = dialog.getByRole("group", { name: "Title" });
		const description = dialog.getByRole("group", { name: "Description" });

		await title.getByRole("button").click();
		await title.getByRole("textbox").fill("Draft");
		await description.getByRole("button").click();

		await expect(card).toHaveText(/todo/);
		await expect(title.getByRole("textbox")).toBeHidden();
		await expect(description.getByRole("textbox")).toBeVisible();
	});

	test("should save the description", async ({ page }) => {
		const { dialog, card } = await openTicket(page);
		const description = dialog.getByRole("group", { name: "Description" });

		await description.getByRole("button").click();
		await description.getByRole("textbox").fill("Line one");
		await description.getByRole("button", { name: "Save" }).click();

		await expect(card).toHaveText(/Line one/);
	});

	test("should move the card when the status changes", async ({ page }) => {
		const { dialog, card } = await openTicket(page);

		await dialog.getByRole("combobox", { name: "Status" }).selectOption("done");

		await expect(card).toHaveCount(0);
		await expect(columnCards(page, "Done")).toHaveCount(1);
		await expect(dialog).toBeVisible();
	});

	test("should show the new assignee on the card", async ({ page }) => {
		const { dialog, card } = await openTicket(page);
		const assignee = dialog.getByRole("group", { name: "Assignee" });

		await assignee.getByRole("button").click();
		await assignee.getByRole("textbox", { name: "Name" }).fill("Ann");
		await assignee.getByRole("textbox", { name: "Email" }).fill("ann@example.com");
		await assignee.getByRole("button", { name: "Save" }).click();

		await expect(card).toHaveText(/Ann/);
	});

	test("should keep submitted values after a reload", async ({ page }) => {
		const { dialog } = await openTicket(page);
		const title = dialog.getByRole("group", { name: "Title" });

		await title.getByRole("button").click();
		await title.getByRole("textbox").fill("Renamed");
		await page.keyboard.press("Enter");
		await page.reload();

		await expect(title.getByRole("button")).toHaveText("Renamed");
	});
});
