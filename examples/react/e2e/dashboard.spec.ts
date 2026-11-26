import { createBoard, expect, test } from "./fixtures";

test.describe("Column", () => {
	test("should keep a created ticket after a reload", async ({ page }) => {
		await createBoard(page, "nn");

		const column = page.getByRole("region", { name: "Backlog" });
		const dialog = page.getByRole("dialog");

		await expect(column.getByRole("listitem")).toHaveCount(0);

		await page.getByRole("button", { name: "New ticket", exact: true }).click();
		await dialog.getByRole("textbox", { name: "Title" }).fill("Persisted");
		await dialog.getByRole("button", { name: "Create ticket" }).click();
		await expect(column.getByRole("listitem")).toHaveCount(1);

		await page.reload();

		await expect(column.getByRole("listitem")).toHaveCount(1);
	});
});
