import { choose, expect, type Page, test } from "./fixtures";

const columnCards = (page: Page, column: string) =>
	page.getByRole("region", { name: column, includeHidden: true }).getByRole("listitem", { includeHidden: true });

const newTicket = (page: Page) => page.getByRole("button", { name: "New ticket", exact: true });

const addTicket = async (page: Page) => {
	const dialog = page.getByRole("dialog");

	await page.goto("/");
	await newTicket(page).click();
	await dialog.getByRole("textbox", { name: "Title" }).fill("todo");
	await dialog.getByRole("button", { name: "Create ticket" }).click();
	await expect(dialog).toBeHidden();

	return { dialog, card: columnCards(page, "To do") };
};

test.describe("Create ticket", () => {
	test("should open an empty form", async ({ page }) => {
		await page.goto("/");
		await newTicket(page).click();

		const dialog = page.getByRole("dialog");

		await expect(dialog).toBeVisible();
		await expect(dialog.getByRole("textbox", { name: "Title" })).toHaveValue("");
		await expect(dialog.getByRole("combobox", { name: "Status" })).toHaveText("To do");
		await expect(dialog.getByRole("combobox", { name: "Assignee" })).toHaveText("Unassigned");
	});

	test("should create a ticket with every field on Create ticket", async ({ page }) => {
		await page.goto("/");
		await newTicket(page).click();

		const dialog = page.getByRole("dialog");

		await dialog.getByRole("textbox", { name: "Title" }).fill("Created");
		await dialog.getByRole("textbox", { name: "Description" }).fill("Line one");
		await choose(dialog.getByRole("combobox", { name: "Status" }), "In progress");
		await choose(dialog.getByRole("combobox", { name: "Assignee" }), "Jan Novak");

		await expect(columnCards(page, "In progress")).toHaveCount(0);

		await dialog.getByRole("button", { name: "Create ticket" }).click();

		const card = columnCards(page, "In progress");

		await expect(dialog).toBeHidden();
		await expect(card).toHaveCount(1);
		await expect(card).toHaveText(/Created/);
		await expect(card).toHaveText(/Jan Novak/);

		await card.getByRole("link").click();

		await expect(dialog.getByRole("textbox", { name: "Description" })).toHaveValue("Line one");
	});

	test("should not create a ticket when closed without saving", async ({ page }) => {
		await page.goto("/");
		await newTicket(page).click();

		const dialog = page.getByRole("dialog");

		await dialog.getByRole("textbox", { name: "Title" }).fill("Discarded");
		await page.keyboard.press("Escape");

		await expect(dialog).toBeHidden();
		await expect(page.locator("li")).toHaveCount(0);
	});

	test("should create a ticket with Mod+Enter", async ({ page }) => {
		await page.goto("/");
		await newTicket(page).click();

		const dialog = page.getByRole("dialog");

		await dialog.getByRole("textbox", { name: "Title" }).fill("Shortcut");
		await page.keyboard.press("ControlOrMeta+Enter");

		await expect(dialog).toBeHidden();
		await expect(columnCards(page, "To do")).toHaveText(/Shortcut/);
	});

	test("should not create a ticket without a title", async ({ page }) => {
		await page.goto("/");
		await newTicket(page).click();

		const dialog = page.getByRole("dialog");

		await dialog.getByRole("button", { name: "Create ticket" }).click();

		await expect(dialog.getByRole("textbox", { name: "Title" })).toBeFocused();
		await expect(dialog).toBeVisible();
		await expect(page.locator("li")).toHaveCount(0);
	});
});

test.describe("TicketModal", () => {
	test("should open a ticket from its card", async ({ page }) => {
		const { dialog } = await addTicket(page);

		await page.getByRole("link", { name: "todo" }).click();

		await expect(dialog).toBeVisible();
		await expect(dialog.getByRole("textbox", { name: "Title" })).toHaveValue("todo");
		await expect(dialog.getByRole("button", { name: "Create ticket" })).toHaveCount(0);
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

	test("should keep the board filter after closing a ticket", async ({ page }) => {
		const { dialog } = await addTicket(page);

		await page.getByRole("link", { name: "todo" }).click();
		await dialog.getByRole("textbox", { name: "Labels" }).fill("bug");
		await page.keyboard.press("Enter");
		await page.keyboard.press("Escape");
		await expect(dialog).toBeHidden();

		await page.goto("/?label=bug");
		await page.getByRole("link", { name: "todo" }).click();
		await expect(dialog).toBeVisible();
		await page.keyboard.press("Escape");

		await expect(dialog).toBeHidden();
		await expect(page).toHaveURL(/\/\?label=bug$/);
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

		if (!box) throw new Error("Title is not rendered");

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

	test("should create a ticket from an unknown ticket", async ({ page }) => {
		await page.goto("/tickets/missing");

		const dialog = page.getByRole("dialog");

		await expect(dialog.getByRole("textbox", { name: "Title" })).toHaveValue("");

		await dialog.getByRole("textbox", { name: "Title" }).fill("Recovered");
		await dialog.getByRole("button", { name: "Create ticket" }).click();

		await expect(dialog).toBeHidden();
		await expect(page).toHaveURL(/\/$/);
		await expect(columnCards(page, "Backlog")).toHaveText(/Recovered/);
	});

	test("should keep a ticket created in a filtered board", async ({ page }) => {
		const dialog = page.getByRole("dialog");

		await page.goto("/?label=bug");
		await newTicket(page).click();
		await choose(dialog.getByRole("combobox", { name: "Status" }), "In progress");
		await dialog.getByRole("textbox", { name: "Title" }).fill("Filtered");
		await dialog.getByRole("button", { name: "Create ticket" }).click();

		const card = columnCards(page, "In progress");

		await expect(dialog).toBeHidden();
		await expect(page).toHaveURL(/\/\?label=bug$/);
		await expect(card).toHaveCount(1);
		await expect(card).toHaveText(/Filtered/);
		await expect(card).toHaveText(/bug/);
	});
});

test.describe("TicketModal editing", () => {
	const openTicket = async (page: Page) => {
		const result = await addTicket(page);

		await page.getByRole("link", { name: "todo" }).click();
		await expect(result.dialog).toBeVisible();

		return result;
	};

	test("should save the title when it loses focus", async ({ page }) => {
		const { dialog, card } = await openTicket(page);

		await dialog.getByRole("textbox", { name: "Title" }).fill("Renamed");

		await expect(card).toHaveText(/todo/);

		await dialog.getByRole("textbox", { name: "Description" }).click();

		await expect(card).toHaveText(/Renamed/);
		await expect(dialog).toBeVisible();
	});

	test("should save every field as it changes and on close", async ({ page }) => {
		const { dialog } = await openTicket(page);

		await choose(dialog.getByRole("combobox", { name: "Status" }), "Done");

		await expect(columnCards(page, "To do")).toHaveCount(0);
		await expect(columnCards(page, "Done")).toHaveCount(1);

		await choose(dialog.getByRole("combobox", { name: "Assignee" }), "Jan Novak");
		await dialog.getByRole("textbox", { name: "Title" }).fill("Renamed");
		await dialog.getByRole("textbox", { name: "Description" }).fill("Line one");
		await dialog.getByRole("button", { name: "Close" }).last().click();

		const card = columnCards(page, "Done");

		await expect(dialog).toBeHidden();
		await expect(card).toHaveText(/Renamed/);
		await expect(card).toHaveText(/Jan Novak/);

		await page.reload();
		await expect(card).toHaveText(/Renamed/);
		await card.getByRole("link").click();

		await expect(dialog.getByRole("textbox", { name: "Description" })).toHaveValue("Line one");
	});

	test("should not save an empty title", async ({ page }) => {
		const { dialog, card } = await openTicket(page);
		const title = dialog.getByRole("textbox", { name: "Title" });

		await title.fill("   ");
		await dialog.getByRole("textbox", { name: "Description" }).click();

		await expect(title).toHaveValue("todo");
		await expect(card).toHaveText(/todo/);
	});

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
});

test.describe("TicketModal deleting", () => {
	const confirmDelete = async (page: Page) => {
		await page.getByRole("dialog").getByRole("button", { name: "Delete" }).click();
		await page.getByRole("alertdialog").getByRole("button", { name: "Delete" }).click();
	};

	test("should not offer deleting a new ticket", async ({ page }) => {
		await page.goto("/");
		await newTicket(page).click();

		await expect(page.getByRole("dialog").getByRole("button", { name: "Delete" })).toHaveCount(0);
	});

	test("should keep the ticket when the deletion is cancelled", async ({ page }) => {
		const { dialog, card } = await addTicket(page);

		await page.getByRole("link", { name: "todo" }).click();
		await dialog.getByRole("button", { name: "Delete" }).click();
		await page.getByRole("alertdialog").getByRole("button", { name: "Cancel" }).click();

		await expect(page.getByRole("alertdialog")).toBeHidden();
		await expect(dialog).toBeVisible();
		await expect(card).toHaveCount(1);
	});

	test("should delete the ticket and close", async ({ page }) => {
		const { dialog, card } = await addTicket(page);

		await page.getByRole("link", { name: "todo" }).click();
		await confirmDelete(page);

		await expect(dialog).toBeHidden();
		await expect(card).toHaveCount(0);
		await expect(page).toHaveURL(/\/$/);
	});

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

		await other.goto("/");
		await expect(columnCards(other, "To do")).toHaveCount(1);

		await page.getByRole("link", { name: "todo" }).click();
		await confirmDelete(page);
		await expect(card).toHaveCount(0);

		await expect(columnCards(other, "To do")).toHaveCount(0);
		await other.reload();
		await expect(newTicket(other)).toBeVisible();
		await expect(columnCards(other, "To do")).toHaveCount(0);
	});
});
