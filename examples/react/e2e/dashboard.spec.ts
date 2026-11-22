import { expect, type Page, test } from "./fixtures";

const newTicket = (page: Page) =>
	page.getByRole("region", { name: "To do" }).getByRole("button", { name: "New ticket in To do" }).first();

test.describe("Board", () => {
	test("has one level-one heading", async ({ page }) => {
		await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
	});
});

test.describe("Column", () => {
	test("should keep a created ticket after a reload", async ({ page }) => {
		await page.goto("/");

		const column = page.getByRole("region", { name: "To do" });
		const dialog = page.getByRole("dialog");

		await expect(column.getByRole("listitem")).toHaveCount(0);

		await newTicket(page).click();
		await dialog.getByRole("textbox", { name: "Title" }).fill("Persisted");
		await dialog.getByRole("button", { name: "Create ticket" }).click();
		await expect(column.getByRole("listitem")).toHaveCount(1);

		await page.reload();

		await expect(column.getByRole("listitem")).toHaveCount(1);
	});

	test("shows empty columns for an unknown label", async ({ page }) => {
		await newTicket(page).click();
		await page.getByRole("dialog").getByRole("textbox", { name: "Title" }).fill("Unlabelled");
		await page.getByRole("dialog").getByRole("button", { name: "Create ticket" }).click();
		await expect(page.getByRole("region", { name: "To do" }).getByRole("listitem")).toHaveCount(1);

		await page.goto("/?label=gone");

		for (const name of ["To do", "In progress", "Done"]) {
			await expect(page.getByRole("region", { name }).getByRole("listitem")).toHaveCount(0);
		}

		await page.getByRole("link", { name: "Board" }).click();

		await expect(page).toHaveURL("/");
		await expect(page.getByRole("region", { name: "To do" }).getByRole("listitem")).toHaveCount(1);
	});

	test("filters the board by label", async ({ page }) => {
		const dialog = page.getByRole("dialog");
		const navigation = page.getByRole("navigation");
		const column = page.getByRole("region", { name: "To do" }).getByRole("listitem");

		await newTicket(page).click();
		await dialog.getByRole("textbox", { name: "Title" }).fill("Labelled");
		await dialog.getByRole("textbox", { name: "Labels" }).fill("bug");
		await page.keyboard.press("Enter");
		await dialog.getByRole("button", { name: "Create ticket" }).click();
		await expect(dialog).toBeHidden();

		await newTicket(page).click();
		await dialog.getByRole("textbox", { name: "Title" }).fill("Plain");
		await dialog.getByRole("button", { name: "Create ticket" }).click();
		await expect(column).toHaveCount(2);

		await navigation.getByRole("link", { name: "bug" }).click();

		await expect(column).toHaveCount(1);

		await navigation.getByRole("link", { name: "Board" }).click();

		await expect(column).toHaveCount(2);
	});
});
