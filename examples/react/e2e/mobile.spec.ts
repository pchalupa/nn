import { choose, expect, type Page, signUp, test } from "./fixtures";

test.use({ viewport: { width: 390, height: 844 } });

test.beforeEach(async ({ page }) => {
	await page.addStyleTag({ content: "[data-nn-devtools] { display: none; }" });
});

const createTicket = async (page: Page, title: string) => {
	const dialog = page.getByRole("dialog");

	await page.getByRole("button", { name: "New ticket" }).click();
	await dialog.getByRole("textbox", { name: "Title" }).fill(title);
	await dialog.getByRole("button", { name: "Create ticket" }).click();
	await expect(dialog).toBeHidden();
};

const openMenu = async (page: Page) => {
	await page.getByRole("button", { name: "Open menu" }).click();

	return page.getByRole("dialog", { name: "Menu" });
};

test.describe("Mobile sign up", () => {
	test.use({ signedIn: false });

	test("signs up without a card and lands on the mobile board", async ({ page }) => {
		await signUp(page);

		await expect(page.getByRole("heading", { level: 1 })).toHaveText(["nn"]);
		await expect(page.getByRole("button", { name: "Open menu" })).toBeVisible();
		await expect(page.getByRole("navigation")).toBeHidden();
	});
});

test.describe("Mobile board", () => {
	test("filters by Assigned to me from the drawer and clears the chip", async ({ page }) => {
		const drawer = await openMenu(page);

		await drawer.getByRole("link", { name: /^Assigned to me/ }).click();

		const clear = page.getByRole("button", { name: "Clear filter Assignee: Me" });

		await expect(drawer).toBeHidden();
		await expect(page).toHaveURL("/?assignee=me");
		await expect(clear).toBeVisible();

		await clear.click();

		await expect(page).toHaveURL("/");
		await expect(clear).toBeHidden();
	});

	test("scrolls the four columns sideways and creates a backlog ticket", async ({ page }) => {
		await createTicket(page, "Planned");
		await expect(page.getByRole("region", { name: "Backlog" }).getByRole("listitem")).toHaveCount(1);

		const done = page.getByRole("region", { name: "Done" });

		await expect(page.getByRole("region")).toHaveCount(4);
		await expect(done).not.toBeInViewport();

		await done.scrollIntoViewIfNeeded();

		await expect(done).toBeInViewport();
		expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
	});

	test("adds labels from + Add label on the full-screen ticket", async ({ page }) => {
		await createTicket(page, "Labelled");
		await page.getByRole("region", { name: "Backlog" }).getByRole("link").click();

		const dialog = page.getByRole("dialog");
		const input = dialog.getByRole("textbox", { name: "Labels" });

		await expect(input).toBeHidden();
		await dialog.getByRole("button", { name: "Add label" }).click();
		await expect(input).toBeFocused();

		await input.fill("bug");
		await input.press("Enter");

		await expect(dialog.getByRole("button", { name: "Remove bug" })).toBeVisible();
		await expect(input).toBeFocused();

		await input.press("Escape");

		await expect(input).toBeHidden();
		await expect(dialog).toBeVisible();
	});

	test("opens a ticket full screen and returns to the board with its change", async ({ page }) => {
		await createTicket(page, "Moving");
		await page.getByRole("region", { name: "Backlog" }).getByRole("link").click();

		const dialog = page.getByRole("dialog");

		await expect(dialog).toBeVisible();
		await expect.poll(() => dialog.boundingBox()).toStrictEqual({ x: 0, y: 0, width: 390, height: 844 });

		const status = await dialog.getByRole("combobox", { name: "Status" }).boundingBox();
		const description = await dialog.getByRole("textbox", { name: "Description" }).boundingBox();

		expect(status?.y).toBeLessThan(description?.y ?? 0);

		await choose(dialog.getByRole("combobox", { name: "Status" }), "Done");
		await dialog.getByRole("button", { name: "Back" }).click();

		await expect(dialog).toBeHidden();
		await expect(page).toHaveURL("/");
		await expect(page.getByRole("region", { name: "Backlog" }).getByRole("listitem")).toHaveCount(0);
		await expect(page.getByRole("region", { name: "Done" }).getByRole("listitem")).toHaveText([/Moving/]);
	});
});

test.describe("Mobile profile", () => {
	test("renames the user with Save changes", async ({ page }) => {
		const drawer = await openMenu(page);

		await drawer.getByRole("link", { name: "Jan Novak" }).click();
		await expect(page).toHaveURL("/profile");
		await expect(page.getByRole("heading", { level: 1 })).toHaveText(["Profile"]);

		await page.getByRole("textbox", { name: "Name" }).fill("Jana Novakova");
		await page.getByRole("button", { name: "Save changes" }).click();

		await expect(page.getByRole("heading", { name: "Jana Novakova" })).toBeVisible();

		await page.reload();

		await expect(page.getByRole("textbox", { name: "Name" })).toHaveValue("Jana Novakova");
	});
});
