import { expect, test } from "./fixtures";

test.describe("Profile", () => {
	test.beforeEach(async ({ page }) => {
		await page.getByRole("link", { name: "Jan Novak" }).click();
		await expect(page).toHaveURL("/profile");
	});

	test("has one level-one heading", async ({ page }) => {
		await expect(page.getByRole("heading", { level: 1 })).toHaveText(["Profile"]);
	});

	test("renames the user", async ({ page }) => {
		await page.getByRole("textbox", { name: "Name" }).fill("Jana Novakova");
		await page.getByRole("button", { name: "Save changes" }).click();

		await expect(page.getByRole("link", { name: "Jana Novakova" })).toBeVisible();

		await page.reload();

		await expect(page.getByRole("link", { name: "Jana Novakova" })).toBeVisible();
	});

	test("discards the rename on Cancel", async ({ page }) => {
		const name = page.getByRole("textbox", { name: "Name" });

		await name.fill("Jana Novakova");
		await page.getByRole("button", { name: "Cancel" }).click();

		await expect(name).toHaveValue("Jan Novak");
		await expect(page.getByRole("link", { name: "Jan Novak" })).toBeVisible();
	});

	test("keeps typed-but-unsaved text when resized to mobile", async ({ page }) => {
		const name = page.getByRole("textbox", { name: "Name" });

		await name.fill("Jana Novakova");
		await page.setViewportSize({ width: 390, height: 844 });

		await expect(page.getByRole("button", { name: "Open menu" })).toBeVisible();
		await expect(page.getByRole("navigation")).toBeHidden();
		await expect(name).toHaveValue("Jana Novakova");
		await expect(page.getByRole("textbox", { name: "Name" })).toHaveCount(1);
		await expect(page.locator('input[name="name"]')).toHaveCount(1);
	});

	test("signs out", async ({ page }) => {
		await page.getByRole("button", { name: "Sign out" }).click();

		await expect(page).toHaveURL("/sign-in");
	});
});
