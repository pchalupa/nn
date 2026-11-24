import type { Locator } from "@playwright/test";

import { expect, type Page, test } from "./fixtures";

const createTicket = async (page: Page, title: string) => {
	const dialog = page.getByRole("dialog");

	await page.getByRole("button", { name: "New ticket" }).filter({ visible: true }).click();
	await dialog.getByRole("textbox", { name: "Title" }).fill(title);
	await dialog.getByRole("button", { name: "Create ticket" }).click();
	await expect(dialog).toBeHidden();
};

const column = (page: Page, name: string) => page.getByRole("region", { name });

const card = (page: Page, title: string) => page.getByRole("link", { name: new RegExp(`^${title}`) });

const titlesIn = (region: Locator) => region.getByRole("listitem").getByRole("link");

interface Point {
	x: number;
	y: number;
}

const centerOf = async (locator: Locator) => {
	const box = await locator.boundingBox();

	if (!box) throw new Error("Element has no box");

	return { x: box.x + box.width / 2, y: box.y + box.height / 2, box };
};

/** Drags with the mouse in small steps, as dnd-kit needs moves after the press to start and to track the drag. */
const mouseDrag = async (page: Page, from: Locator, to: Point) => {
	const start = await centerOf(from);

	await page.mouse.move(start.x, start.y);
	await page.mouse.down();
	await page.mouse.move(start.x + 10, start.y + 10, { steps: 5 });
	await page.mouse.move(to.x, to.y, { steps: 20 });
	await page.mouse.move(to.x, to.y + 1);
	await page.mouse.up();
};

test.describe("Board drag and drop", () => {
	test("moves a card to another column and keeps it there after a reload", async ({ page }) => {
		await createTicket(page, "Ship it");

		const target = await centerOf(column(page, "Done"));

		await mouseDrag(page, card(page, "Ship it"), target);

		await expect(titlesIn(column(page, "Done"))).toHaveText([/^Ship it/]);
		await expect(titlesIn(column(page, "Backlog"))).toHaveCount(0);

		await page.reload();

		await expect(titlesIn(column(page, "Done"))).toHaveText([/^Ship it/]);
	});

	test("reorders cards within a column", async ({ page }) => {
		await createTicket(page, "First");
		await createTicket(page, "Second");
		await expect(titlesIn(column(page, "Backlog"))).toHaveText([/^First/, /^Second/]);

		const below = await centerOf(card(page, "Second"));

		await mouseDrag(page, card(page, "First"), { x: below.x, y: below.y + below.box.height / 2 });

		await expect(titlesIn(column(page, "Backlog"))).toHaveText([/^Second/, /^First/]);
	});

	test("shows a move on another device", async ({ page, openDevice }) => {
		const phone = await openDevice({ passkeysFrom: page, signedIn: true });

		await createTicket(page, "Synced move");
		await expect(titlesIn(column(phone, "Backlog"))).toHaveText([/^Synced move/]);

		await mouseDrag(page, card(page, "Synced move"), await centerOf(column(page, "In progress")));

		await expect(titlesIn(column(phone, "In progress"))).toHaveText([/^Synced move/]);
	});
});
