import { expect, test } from "./fixtures";

test.describe("Profile", () => {
	test("renames the user", async ({ page }) => {
		await page.goto("/");
		await page.getByRole("link", { name: "Jan Novak" }).click();

		await expect(page).toHaveURL("/profile");

		const name = page.getByRole("textbox", { name: "Name" });

		await name.fill("Jana Novakova");
		await page.getByRole("button", { name: "Save changes" }).click();
		await page.reload();

		await expect(page.getByRole("link", { name: "Jana Novakova" })).toBeVisible();
	});
});
