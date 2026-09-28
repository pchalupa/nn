// @vitest-environment jsdom
import { Collection } from "@nn/entities/Collection";
import { LWWRegister } from "@nn/entities/LWWRegister";
import { Row } from "@nn/entities/Row";
import { array, object, string } from "@nn/schema";
import { Store } from "@nn/store";
import { act, cleanup, render, screen } from "@testing-library/react";
import { Suspense } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createStore, use } from "./index";

const ticket = (id: string, status: string) => new Row(id, { status: new LWWRegister(status) });

const setup = () => {
	const tickets = new Collection([ticket("1", "todo"), ticket("2", "done"), ticket("3", "done")]);
	const language = new LWWRegister<string | undefined>("en");
	const store = new Store({ tickets, language });

	return { store, tickets, language, useStore: use(Promise.resolve(store)) };
};

const mount = async (ui: React.ReactNode) => {
	let rendered: ReturnType<typeof render> | undefined;

	await act(async () => {
		rendered = render(<Suspense fallback="loading">{ui}</Suspense>);
	});

	const rerender = async (next: React.ReactNode) => {
		await act(async () => {
			rendered?.rerender(<Suspense fallback="loading">{next}</Suspense>);
		});
	};

	return { rerender };
};

afterEach(cleanup);

describe("createStore", () => {
	it("should create a store", async () => {
		const store = await createStore({ schema: object({}) });

		expect(store).toHaveProperty("events");
		expect(store.view).toStrictEqual({});
	});

	it("should expose the schema as a view", async () => {
		const store = await createStore({
			schema: object({ tickets: array(object({ title: string() })), language: string() }),
		});

		expect(store.view).toStrictEqual({ tickets: [], language: undefined });
	});
});

describe("useStore", () => {
	it("should render the selected view", async () => {
		const { useStore } = setup();
		const Tickets = () => {
			const [tickets] = useStore((view) => view.tickets);

			return (
				<ul>
					{tickets.map((row) => (
						<li key={row.id}>{row.status}</li>
					))}
				</ul>
			);
		};

		await mount(<Tickets />);

		expect(screen.getAllByRole("listitem")).toHaveLength(3);
	});

	it("should re-render when the selection changes", async () => {
		const { tickets, useStore } = setup();
		const Tickets = () => {
			const [rows] = useStore((view) => view.tickets);

			return <span data-testid="count">{rows.length}</span>;
		};

		await mount(<Tickets />);

		expect(screen.getByTestId("count").textContent).toBe("3");

		await act(async () => {
			tickets.push(ticket("4", "todo"));
		});

		expect(screen.getByTestId("count").textContent).toBe("4");
	});

	it("should re-render when a field of a row changes", async () => {
		const { tickets, useStore } = setup();
		const Tickets = () => {
			const [rows] = useStore((view) => view.tickets);

			return <span data-testid="statuses">{rows.map((row) => row.status).join(",")}</span>;
		};

		await mount(<Tickets />);

		expect(screen.getByTestId("statuses").textContent).toBe("todo,done,done");

		const second = tickets.find("2");

		await act(async () => {
			if (second) second.field("status").current = "todo";
		});

		expect(screen.getByTestId("statuses").textContent).toBe("todo,todo,done");
	});

	it("should not re-render when an unrelated property changes", async () => {
		const { language, useStore } = setup();
		const rendered = vi.fn();
		const Tickets = () => {
			const [rows] = useStore((view) => view.tickets);

			rendered();

			return <span data-testid="count">{rows.length}</span>;
		};

		await mount(<Tickets />);

		const before = rendered.mock.calls.length;

		await act(async () => {
			language.current = "cs";
		});

		expect(rendered).toHaveBeenCalledTimes(before);
	});

	it("should settle when the selector derives a new array on every call", async () => {
		const { language, useStore } = setup();
		const rendered = vi.fn();
		const Column = ({ status }: { status: string }) => {
			const [rows] = useStore((view) => view.tickets.filter((row) => row.status === status));

			rendered();

			return <span data-testid="count">{rows.length}</span>;
		};

		await mount(<Column status="done" />);

		const before = rendered.mock.calls.length;

		// A filtered selection is a fresh array every time the selector runs. If the store did not
		// return the previous reference, this notification would re-render forever.
		await act(async () => {
			language.current = "cs";
		});

		expect(rendered).toHaveBeenCalledTimes(before);
		expect(screen.getByTestId("count").textContent).toBe("2");
	});

	it("should follow a selector that closes over a changing prop", async () => {
		const { useStore } = setup();
		const Column = ({ status }: { status: string }) => {
			const [rows] = useStore((view) => view.tickets.filter((row) => row.status === status));

			return <span data-testid="count">{rows.length}</span>;
		};

		const { rerender } = await mount(<Column status="todo" />);

		expect(screen.getByTestId("count").textContent).toBe("1");

		await rerender(<Column status="done" />);

		expect(screen.getByTestId("count").textContent).toBe("2");
	});

	it("should write through the updater", async () => {
		const { store, useStore } = setup();
		const Tickets = () => {
			const [rows, update] = useStore((view) => view.tickets);
			const handleClick = () =>
				update((draft) => {
					draft.push({ id: "4", status: "todo" });
				});

			return (
				<button type="button" onClick={handleClick}>
					{rows.length}
				</button>
			);
		};

		await mount(<Tickets />);

		await act(async () => {
			screen.getByRole("button").click();
		});

		expect(screen.getByRole("button").textContent).toBe("4");
		expect(store.view.tickets.at(-1)).toStrictEqual({ id: "4", status: "todo" });
	});

	it("should write through the updater for a register", async () => {
		const { store, useStore } = setup();
		const Language = () => {
			const [language, setLanguage] = useStore((view) => view.language);

			return (
				<button type="button" onClick={() => setLanguage(() => "cs")}>
					{language}
				</button>
			);
		};

		await mount(<Language />);

		expect(screen.getByRole("button").textContent).toBe("en");

		await act(async () => {
			screen.getByRole("button").click();
		});

		expect(screen.getByRole("button").textContent).toBe("cs");
		expect(store.view.language).toBe("cs");
	});
});
