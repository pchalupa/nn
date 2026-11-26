import { createBoard, expect, openBoard, type Page, setOnline, test } from "./fixtures";

const createTicket = async (page: Page, title: string) => {
	const dialog = page.getByRole("dialog");

	await page.getByRole("button", { name: "New ticket", exact: true }).click();
	await dialog.getByRole("textbox", { name: "Title" }).fill(title);
	await dialog.getByRole("button", { name: "Create ticket" }).click();
	await expect(dialog).toBeHidden();
};

test("shows a ticket created on one device on another", async ({ page, openDevice }) => {
	const laptop = page;
	const phone = await openDevice({ passkeysFrom: laptop, signedIn: true });

	await createBoard(laptop, "nn");
	await openBoard(phone, "nn");
	await createTicket(laptop, "Sync me");

	await expect(phone.getByRole("region", { name: "Backlog" }).getByRole("link", { name: /Sync me/ })).toBeVisible();
});

test("gives a new device the full board", async ({ page, openDevice }) => {
	await createBoard(page, "nn");
	await createTicket(page, "First");
	await createTicket(page, "Second");
	await createTicket(page, "Third");
	await expect(page.getByText("3 tickets").filter({ visible: true })).toBeVisible();

	const fresh = await openDevice({ passkeysFrom: page, signedIn: true });

	await openBoard(fresh, "nn");

	await expect(fresh.getByRole("heading", { level: 1 })).toBeVisible();
	await expect(fresh.getByText("3 tickets").filter({ visible: true })).toBeVisible();
});

test("keeps changes from a device while it is offline", async ({ page, openDevice }) => {
	const phone = await openDevice({ passkeysFrom: page, signedIn: true });
	const tablet = await openDevice({ passkeysFrom: page, signedIn: true });

	await createBoard(page, "nn");
	await openBoard(phone, "nn");
	await openBoard(tablet, "nn");
	await setOnline(phone, false);
	await createTicket(page, "While away");

	await expect(tablet.getByRole("link", { name: /While away/ })).toBeVisible();
	await expect(phone.getByRole("link", { name: /While away/ })).toHaveCount(0);
});
