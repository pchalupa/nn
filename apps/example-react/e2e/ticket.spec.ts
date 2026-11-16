import { expect, type Page, test } from "./fixtures";

const columnCards = (page: Page, column: string) => page.getByRole("region", { name: column }).getByRole("article");

const createTicket = async (page: Page, title: string) => {
	const dialog = page.locator("dialog");

	await page.getByRole("button", { name: "New ticket C" }).click();
	await dialog.getByRole("textbox", { name: "Title" }).fill(title);
	await dialog.getByRole("button", { name: /Save changes/ }).click();
	await expect(dialog).toBeHidden();

	return { dialog, card: columnCards(page, "To do") };
};

const openTicket = async (page: Page, title: string) => {
	const result = await createTicket(page, title);

	await page.getByRole("link", { name: title }).click();
	await expect(result.dialog).toBeVisible();

	return result;
};

test.beforeEach(async ({ page }) => {
	await page.goto("/");
});

test.describe("Create ticket", () => {
	test("should open an empty form", async ({ page }) => {
		await page.getByRole("button", { name: "New ticket C" }).click();

		const dialog = page.locator("dialog");

		await expect(dialog.getByRole("textbox", { name: "Title" })).toHaveValue("");
		await expect(dialog.getByRole("combobox", { name: "Status" })).toHaveValue("todo");
		await expect(dialog.getByRole("combobox", { name: "Assignee" })).toHaveValue("");
	});

	test("should open from the keyboard shortcut", async ({ page }) => {
		await expect(page.getByRole("region", { name: "To do" })).toBeVisible();
		await page.keyboard.press("c");

		await expect(page.locator("dialog").getByRole("textbox", { name: "Title" })).toBeVisible();
	});

	test("should create a ticket in the column it was started from", async ({ page }) => {
		const dialog = page.locator("dialog");

		await page.getByRole("region", { name: "Done" }).getByRole("button", { name: "New ticket" }).click();
		await dialog.getByRole("textbox", { name: "Title" }).fill("Finished");
		await dialog.getByRole("button", { name: /Save changes/ }).click();

		await expect(columnCards(page, "Done")).toHaveText(/Finished/);
	});

	test("should create a ticket with every field", async ({ page }) => {
		const dialog = page.locator("dialog");

		await page.getByRole("button", { name: "New ticket C" }).click();
		await dialog.getByRole("textbox", { name: "Title" }).fill("Created");
		await dialog.getByRole("textbox", { name: "Description" }).fill("Line one");
		await dialog.getByRole("combobox", { name: "Status" }).selectOption("in-progress");
		await dialog.getByRole("combobox", { name: "Assignee" }).selectOption({ label: "Jan Novak" });
		await dialog.getByRole("button", { name: /Save changes/ }).click();

		const card = columnCards(page, "In progress");

		await expect(dialog).toBeHidden();
		await expect(card).toHaveText(/Created/);
		await expect(card).toHaveText(/#1/);
		await expect(card).toHaveText(/Jan Novak/);
	});

	test("should not create a ticket when closed without saving", async ({ page }) => {
		const dialog = page.locator("dialog");

		await page.getByRole("button", { name: "New ticket C" }).click();
		await dialog.getByRole("textbox", { name: "Title" }).fill("Discarded");
		await page.keyboard.press("Escape");

		await expect(dialog).toBeHidden();
		await expect(page.getByRole("article")).toHaveCount(0);
	});

	test("should not create a ticket without a title", async ({ page }) => {
		const dialog = page.locator("dialog");

		await page.getByRole("button", { name: "New ticket C" }).click();
		await dialog.getByRole("button", { name: /Save changes/ }).click();

		await expect(dialog.getByRole("textbox", { name: "Title" })).toBeFocused();
		await expect(page.getByRole("article")).toHaveCount(0);
	});
});

test.describe("Ticket modal", () => {
	test("should open a ticket from its card in view mode", async ({ page }) => {
		const { dialog } = await openTicket(page, "Viewed");

		await expect(dialog.getByRole("button", { name: "Viewed" })).toBeVisible();
		await expect(dialog.getByRole("textbox", { name: "Title" })).toHaveCount(0);
		await expect(page).toHaveURL(/\/tickets\/[^/]+$/);
	});

	test("should close with Escape", async ({ page }) => {
		const { dialog } = await openTicket(page, "Escaped");

		await page.keyboard.press("Escape");

		await expect(dialog).toBeHidden();
		await expect(page).toHaveURL(/\/$/);
	});

	test("should close by clicking the backdrop", async ({ page }) => {
		const { dialog } = await openTicket(page, "Backdrop");

		await page.mouse.click(5, 5);

		await expect(dialog).toBeHidden();
	});

	test("should reopen the ticket from its URL after a reload", async ({ page }) => {
		const { dialog } = await openTicket(page, "Reloaded");

		await page.reload();

		await expect(dialog.getByRole("button", { name: "Reloaded" })).toBeVisible();
	});

	test("should show a missing ticket as not found", async ({ page }) => {
		await page.goto("/tickets/missing");

		await expect(page.locator("dialog")).toHaveText(/Ticket not found/);
	});

	test("should delete a ticket after confirming", async ({ page }) => {
		const { dialog, card } = await openTicket(page, "Doomed");

		await dialog.getByRole("button", { name: "Delete" }).click();
		await page.getByRole("alertdialog").getByRole("button", { name: "Delete" }).click();

		await expect(dialog).toBeHidden();
		await expect(card).toHaveCount(0);
	});
});

test.describe("Ticket editing", () => {
	test("should rename the ticket only after saving", async ({ page }) => {
		const { dialog, card } = await openTicket(page, "Original");

		await dialog.getByRole("button", { name: "Original" }).click();
		await dialog.getByRole("textbox", { name: "Title" }).fill("Renamed");

		await expect(dialog).toHaveText(/Unsaved changes/);
		await expect(card).toHaveText(/Original/);

		await page.keyboard.press("Enter");

		await expect(card).toHaveText(/Renamed/);
		await expect(dialog.getByRole("button", { name: "Renamed" })).toBeVisible();
	});

	test("should save every field in one submit", async ({ page }) => {
		const { dialog } = await openTicket(page, "Original");

		await dialog.getByRole("button", { name: "Original" }).click();
		await dialog.getByRole("textbox", { name: "Title" }).fill("Renamed");
		await dialog.getByRole("textbox", { name: "Description" }).fill("Line one");
		await dialog.getByRole("combobox", { name: "Status" }).selectOption("done");
		await dialog.getByRole("combobox", { name: "Assignee" }).selectOption({ label: "Jan Novak" });

		await expect(columnCards(page, "To do")).toHaveCount(1);

		await dialog.getByRole("button", { name: /Save changes/ }).click();

		const card = columnCards(page, "Done");

		await expect(columnCards(page, "To do")).toHaveCount(0);
		await expect(card).toHaveText(/Renamed/);
		await expect(card).toHaveText(/Jan Novak/);
		await expect(dialog).toHaveText(/Line one/);
	});

	test("should not save an empty title", async ({ page }) => {
		const { dialog, card } = await openTicket(page, "Kept");

		await dialog.getByRole("button", { name: "Kept" }).click();
		const title = dialog.getByRole("textbox", { name: "Title" });

		await title.fill("   ");
		await dialog.getByRole("button", { name: /Save changes/ }).click();

		await expect(title).toBeFocused();
		await expect(card).toHaveText(/Kept/);
	});

	test("should save with the keyboard shortcut", async ({ page }) => {
		const { dialog, card } = await openTicket(page, "Shortcut");

		await dialog.getByRole("button", { name: "Shortcut" }).click();
		await dialog.getByRole("textbox", { name: "Description" }).fill("Saved from the keyboard");
		await page.keyboard.press("ControlOrMeta+Enter");

		await expect(dialog).toHaveText(/Saved from the keyboard/);
		await expect(card).toHaveCount(1);
	});
});

test.describe("Labels and links", () => {
	test("should add and remove a label", async ({ page }) => {
		const { dialog, card } = await openTicket(page, "Labelled");

		await dialog.getByRole("button", { name: "Labelled" }).click();
		await dialog.getByRole("textbox", { name: "Add label" }).fill("bug");
		await dialog.getByRole("textbox", { name: "Add label" }).press("Enter");
		await dialog.getByRole("button", { name: /Save changes/ }).click();

		await expect(card).toHaveText(/bug/);
		await expect(page.getByRole("button", { name: /^bug/ })).toBeVisible();

		await dialog.getByRole("button", { name: "Labelled" }).click();
		await dialog.getByRole("button", { name: "Remove bug" }).click();
		await dialog.getByRole("button", { name: /Save changes/ }).click();

		await expect(card).not.toHaveText(/bug/);
	});

	test("should add a PR link", async ({ page }) => {
		const { dialog, card } = await openTicket(page, "Linked");

		await dialog.getByRole("button", { name: "Linked" }).click();
		await dialog.getByRole("textbox", { name: "Add link" }).fill("#212");
		await dialog.getByRole("textbox", { name: "Add link" }).press("Enter");
		await dialog.getByRole("button", { name: /Save changes/ }).click();

		await expect(dialog).toHaveText(/#212/);
		await expect(card.getByLabel("Links")).toHaveText("1");
	});
});

test.describe("Comments", () => {
	test("should add a comment that survives a reload", async ({ page }) => {
		const { dialog, card } = await openTicket(page, "Discussed");

		await dialog.getByRole("textbox", { name: "Write a comment…" }).fill("Looks good");
		await dialog.getByRole("textbox", { name: "Write a comment…" }).press("Enter");

		await expect(dialog).toHaveText(/Looks good/);

		await page.reload();

		await expect(dialog).toHaveText(/Jan Novak/);
		await expect(dialog).toHaveText(/Looks good/);
		await expect(card.getByLabel("Comments")).toHaveText("1");
	});
});

test.describe("Short viewport", () => {
	test.use({ viewport: { width: 1280, height: 640 } });

	test("should keep the ticket actions reachable", async ({ page }) => {
		await page.getByRole("button", { name: "New ticket C" }).click();

		await expect(page.locator("dialog").getByRole("button", { name: /Save changes/ })).toBeInViewport();
	});
});

test.describe("TicketModal deleting", () => {
	test("should not offer deleting a new ticket", async ({ page }) => {
		await page.goto("/");
		await page.getByRole("button", { name: "Create" }).click();

		await expect(page.locator("dialog").getByRole("button", { name: "Delete" })).toHaveCount(0);
	});

	test("should delete the ticket and close", async ({ page }) => {
		const { dialog, card } = await addTicket(page);

		await page.getByRole("link", { name: "todo" }).click();
		await dialog.getByRole("button", { name: "Delete" }).click();

		await expect(dialog).toBeHidden();
		await expect(card).toHaveCount(0);
		await expect(page).toHaveURL(/\/$/);
	});

	test("should keep the ticket deleted after a reload", async ({ page }) => {
		const { dialog, card } = await addTicket(page);

		await page.getByRole("link", { name: "todo" }).click();
		await dialog.getByRole("button", { name: "Delete" }).click();
		await expect(card).toHaveCount(0);
		await page.reload();

		await expect(page.getByRole("button", { name: "Create" })).toBeVisible();
		await expect(card).toHaveCount(0);
	});

	test("should delete the ticket in another tab", async ({ page }) => {
		const { dialog, card } = await addTicket(page);
		const other = await page.context().newPage();

		await other.goto("/");
		await expect(columnCards(other, "To Do")).toHaveCount(1);

		await page.getByRole("link", { name: "todo" }).click();
		await dialog.getByRole("button", { name: "Delete" }).click();
		await expect(card).toHaveCount(0);

		await expect(columnCards(other, "To Do")).toHaveCount(0);
		await other.reload();
		await expect(other.getByRole("button", { name: "Create" })).toBeVisible();
		await expect(columnCards(other, "To Do")).toHaveCount(0);
	});
});
