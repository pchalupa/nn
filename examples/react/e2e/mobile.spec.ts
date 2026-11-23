import { choose, expect, type Page, signUp, test } from "./fixtures";

test.use({ viewport: { width: 390, height: 844 } });

test.beforeEach(async ({ page }) => {
	await page.addStyleTag({ content: "[data-nn-devtools] { display: none; }" });
});

const createTicket = async (page: Page, title: string) => {
	const dialog = page.getByRole("dialog");

	await page.getByRole("button", { name: /^New ticket in / }).click();
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

	test("switches status tabs and creates a ticket in the active status", async ({ page }) => {
		await createTicket(page, "Planned");
		await expect(page.getByRole("region", { name: "To do" }).getByRole("listitem")).toHaveCount(1);

		await page.getByRole("radio", { name: /^In progress/ }).click();

		const inProgress = page.getByRole("region", { name: "In progress" });

		await expect(page.getByRole("region", { name: "To do" })).toBeHidden();
		await expect(inProgress.getByRole("listitem")).toHaveCount(0);

		await page.getByRole("button", { name: "New ticket in In progress" }).click();
		await expect(page.getByRole("dialog").getByRole("combobox", { name: "Status" })).toHaveText("In progress");
		await page.getByRole("dialog").getByRole("textbox", { name: "Title" }).fill("Started");
		await page.getByRole("dialog").getByRole("button", { name: "Create ticket" }).click();

		await expect(inProgress.getByRole("listitem")).toHaveCount(1);

		await expect(inProgress).toHaveText(/Started/);
		await page.getByRole("radio", { name: /^Backlog/ }).click();
		await expect(page.getByRole("region", { name: "Backlog" }).getByRole("listitem")).toHaveCount(0);
	});

	test("fits four content-width status tabs and shows the icon on the selected one", async ({ page }) => {
		await createTicket(page, "Counted");

		const tabs = page.getByRole("radiogroup", { name: "Status" });

		await expect(tabs.getByRole("radio")).toHaveCount(4);
		expect((await tabs.boundingBox())?.width).toBeLessThanOrEqual(358);
		expect(await tabs.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);

		const widths = await tabs.getByRole("radio").evaluateAll((radios) => radios.map((radio) => radio.clientWidth));

		expect(new Set(widths).size).toBeGreaterThan(1);
		await expect(tabs.locator("svg")).toHaveCount(1);
		await expect(tabs.getByRole("radio", { name: /^To do/ }).locator("svg")).toHaveCount(1);

		await tabs.getByRole("radio", { name: /^Done/ }).click();

		await expect(tabs.locator("svg")).toHaveCount(1);
		await expect(tabs.getByRole("radio", { name: /^Done/ }).locator("svg")).toHaveCount(1);
	});

	test("adds labels from + Add label on the full-screen ticket", async ({ page }) => {
		await createTicket(page, "Labelled");
		await page.getByRole("region", { name: "To do" }).getByRole("link").click();

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
		await page.getByRole("region", { name: "To do" }).getByRole("link").click();

		const dialog = page.getByRole("dialog");

		await expect(dialog).toBeVisible();
		await expect.poll(() => dialog.boundingBox()).toStrictEqual({ x: 0, y: 0, width: 390, height: 844 });

		await choose(dialog.getByRole("combobox", { name: "Status" }), "Done");
		await dialog.getByRole("button", { name: "Back" }).click();

		await expect(dialog).toBeHidden();
		await expect(page).toHaveURL("/");
		await expect(page.getByRole("region", { name: "To do" }).getByRole("listitem")).toHaveCount(0);
		await expect(page.getByRole("radio", { name: /^Done/ })).toHaveText(/1/);

		await page.getByRole("radio", { name: /^Done/ }).click();

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
