import { array, boolean, number, object, string } from "@goodstate/schema";
import { Store } from "@goodstate/store";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Tree } from ".";

describe("Tree", () => {
	const schema = object({
		tickets: array(object({ title: string(), done: boolean(), points: number() })),
		language: string(),
	});

	const ticket = { title: "A", done: false, points: 1 };

	it("follows live updates and keeps expansion", () => {
		const store = new Store(schema);

		store.mutate((draft) => {
			draft.tickets.push(ticket);
		});
		render(<Tree store={store} />);
		fireEvent.click(screen.getByRole("treeitem", { name: /^tickets/ }));
		fireEvent.click(screen.getByRole("treeitem", { name: /^0/ }));

		act(() => {
			store.mutate((draft) => {
				draft.language = "cs";
			});
		});

		expect(screen.getByRole("treeitem", { name: /^language/ }).textContent).toContain('"cs"');
		expect(screen.getByRole("treeitem", { name: /^tickets/ }).getAttribute("aria-expanded")).toBe("true");
		expect(screen.getByRole("treeitem", { name: /^0/ }).getAttribute("aria-expanded")).toBe("true");
		expect(screen.getByRole("treeitem", { name: /^title/ }).textContent).toContain('"A"');
	});

	it("collapses branches initially and toggles them on click", () => {
		const store = new Store(schema);

		store.mutate((draft) => {
			draft.tickets.push(ticket);
		});
		render(<Tree store={store} />);

		const tickets = screen.getByRole("treeitem", { name: /^tickets/ });

		expect(tickets.getAttribute("aria-expanded")).toBe("false");
		expect(screen.getByRole("treeitem", { name: /^language/ }).hasAttribute("aria-expanded")).toBe(false);

		fireEvent.click(tickets);

		expect(tickets.getAttribute("aria-expanded")).toBe("true");

		fireEvent.click(tickets);

		expect(tickets.getAttribute("aria-expanded")).toBe("false");
	});

	it("does not expand a branch without children", () => {
		const store = new Store(schema);

		render(<Tree store={store} />);

		const tickets = screen.getByRole("treeitem", { name: /^tickets/ });

		expect(tickets.textContent).toContain("[0]");

		fireEvent.click(tickets);

		expect(tickets.hasAttribute("aria-expanded")).toBe(false);
		expect(screen.queryByRole("group")).toBeNull();

		act(() => {
			store.mutate((draft) => {
				draft.tickets.push(ticket);
			});
		});

		expect(tickets.getAttribute("aria-expanded")).toBe("false");
	});

	it("shows the new store and keeps expansion when the store prop changes", () => {
		const first = new Store(schema);
		const second = new Store(schema);

		first.mutate((draft) => {
			draft.tickets.push(ticket);
		});
		second.mutate((draft) => {
			draft.language = "cs";
			draft.tickets.push(ticket);
		});

		const { rerender } = render(<Tree store={first} />);

		fireEvent.click(screen.getByRole("treeitem", { name: /^tickets/ }));
		rerender(<Tree store={second} />);

		expect(screen.getByRole("treeitem", { name: /^language/ }).textContent).toContain('"cs"');
		expect(screen.getByRole("treeitem", { name: /^tickets/ }).getAttribute("aria-expanded")).toBe("true");
	});

	it("nests expanded rows as tree items one level deeper", () => {
		const store = new Store(schema);

		store.mutate((draft) => {
			draft.tickets.push(ticket);
		});
		render(<Tree store={store} />);
		fireEvent.click(screen.getByRole("treeitem", { name: /^tickets/ }));
		fireEvent.click(screen.getByRole("treeitem", { name: /^0/ }));

		const [tickets, item] = screen.getAllByRole("group");

		expect(screen.getByRole("treeitem", { name: /^tickets/ }).getAttribute("aria-level")).toBe("1");
		expect(within(tickets).getByRole("treeitem", { name: /^0/ }).getAttribute("aria-level")).toBe("2");
		expect(
			within(item)
				.getByRole("treeitem", { name: /^title/ })
				.getAttribute("aria-level"),
		).toBe("3");
	});
});
