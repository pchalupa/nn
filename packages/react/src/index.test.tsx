// @vitest-environment jsdom
import { array, object, string } from "@nn/schema";
import { type DataFromSchema, Store } from "@nn/store";
import { act, cleanup, render, screen } from "@testing-library/react";
import { Suspense } from "react";
import { afterEach, describe, expect, expectTypeOf, it, vi } from "vitest";

import { createStore, use } from "./index";

const setup = async () => {
	const store = await createStore({
		schema: object({ tickets: array(object({ status: string() })), language: string() }),
	});
	store.update(["tickets"], (rows) => {
		rows.push({ key: "1", status: "todo" }, { key: "2", status: "done" }, { key: "3", status: "done" });
		return rows;
	});
	store.update(["language"], () => "en");

	return { store, useStore: use(Promise.resolve(store)) };
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

	const unmount = async () => {
		await act(async () => {
			rendered?.unmount();
		});
	};

	return { rerender, unmount };
};

describe("createStore", () => {
	afterEach(cleanup);

	it("creates a store", async () => {
		const store = await createStore({ schema: object({}) });

		expect(store).toBeInstanceOf(Store);
	});

	it("exposes the schema as a view", async () => {
		const store = await createStore({
			schema: object({ tickets: array(object({ title: string() })), language: string() }),
		});

		expect(store.read(["tickets"])).toStrictEqual([]);
		expect(store.read(["language"])).toBeUndefined();
	});
});

describe("useStore", () => {
	afterEach(cleanup);

	it("renders the selected view", async () => {
		const { useStore } = await setup();
		const Tickets = () => {
			const [tickets] = useStore("tickets");

			return (
				<ul>
					{tickets.map((row) => (
						<li key={row.key}>{row.status}</li>
					))}
				</ul>
			);
		};

		await mount(<Tickets />);

		expect(screen.getAllByRole("listitem")).toHaveLength(3);
	});

	it("re-renders when the selection changes", async () => {
		const { store, useStore } = await setup();
		const Tickets = () => {
			const [rows] = useStore("tickets");

			return <span data-testid="count">{rows.length}</span>;
		};

		await mount(<Tickets />);

		expect(screen.getByTestId("count").textContent).toBe("3");

		await act(async () => {
			store.update(["tickets"], (rows) => {
				rows.push({ key: "4", status: "todo" });
				return rows;
			});
		});

		expect(screen.getByTestId("count").textContent).toBe("4");
	});

	it("re-renders when a field of a row changes", async () => {
		const { store, useStore } = await setup();
		const Tickets = () => {
			const [rows] = useStore("tickets");

			return <span data-testid="statuses">{rows.map((row) => row.status).join(",")}</span>;
		};

		await mount(<Tickets />);

		expect(screen.getByTestId("statuses").textContent).toBe("todo,done,done");

		await act(async () => {
			store.update(["tickets", "2", "status"], () => "todo");
		});

		expect(screen.getByTestId("statuses").textContent).toBe("todo,todo,done");
	});

	it("does not re-render when an unrelated property changes", async () => {
		const { store, useStore } = await setup();
		const rendered = vi.fn();
		const Tickets = () => {
			const [rows] = useStore("tickets");

			rendered();

			return <span data-testid="count">{rows.length}</span>;
		};

		await mount(<Tickets />);

		const before = rendered.mock.calls.length;

		await act(async () => {
			store.update(["language"], () => "cs");
		});

		expect(rendered).toHaveBeenCalledTimes(before);
	});

	it("refreshes a row snapshot when another row changes", async () => {
		const { store, useStore } = await setup();
		const rendered = vi.fn();
		const Ticket = () => {
			const [row] = useStore("tickets", "1");
			rendered();
			return <span>{row?.status}</span>;
		};

		await mount(<Ticket />);
		const before = rendered.mock.calls.length;

		await act(async () => {
			store.update(["tickets", "2", "status"], () => "review");
		});

		expect(rendered.mock.calls.length).toBeGreaterThan(before);
		expect(screen.getByText("todo")).toBeDefined();

		await act(async () => {
			store.update(["tickets", "1", "status"], () => "review");
		});

		expect(rendered.mock.calls.length).toBeGreaterThan(before);
		expect(screen.getByText("review")).toBeDefined();
	});

	it("refreshes rows and collections when a row changes", async () => {
		const { store, useStore } = await setup();
		const rowRendered = vi.fn();
		const collectionRendered = vi.fn();
		const Ticket = () => {
			const [row] = useStore("tickets", "1");
			rowRendered();
			return <span data-testid="row">{row?.status}</span>;
		};
		const Tickets = () => {
			const [rows] = useStore("tickets");
			collectionRendered();
			return <span data-testid="collection">{rows.map((row) => row.status).join(",")}</span>;
		};

		await mount(
			<>
				<Ticket />
				<Tickets />
			</>,
		);
		const rowBefore = rowRendered.mock.calls.length;
		const collectionBefore = collectionRendered.mock.calls.length;

		await act(async () => {
			store.update(["tickets", "1", "status"], () => "progress");
		});

		expect(rowRendered.mock.calls.length).toBeGreaterThan(rowBefore);
		expect(collectionRendered.mock.calls.length).toBeGreaterThan(collectionBefore);
		expect(screen.getByTestId("row").textContent).toBe("progress");
		expect(screen.getByTestId("collection").textContent).toBe("progress,done,done");

		await act(async () => {
			store.update(["tickets", "1", "status"], () => "review");
		});

		expect(rowRendered.mock.calls.length).toBeGreaterThan(rowBefore);
		expect(collectionRendered.mock.calls.length).toBeGreaterThan(collectionBefore);
		expect(screen.getByTestId("row").textContent).toBe("review");
		expect(screen.getByTestId("collection").textContent).toBe("review,done,done");
	});

	it("keeps collection reads stable when a component filters rows", async () => {
		const { store, useStore } = await setup();
		const rendered = vi.fn();
		const Column = ({ status }: { status: string }) => {
			const [tickets] = useStore("tickets");
			const rows = tickets.filter((row) => row.status === status);

			rendered();

			return <span data-testid="count">{rows.length}</span>;
		};

		await mount(<Column status="done" />);

		const before = rendered.mock.calls.length;

		await act(async () => {
			store.update(["language"], () => "cs");
		});

		expect(rendered).toHaveBeenCalledTimes(before);
		expect(screen.getByTestId("count").textContent).toBe("2");
	});

	it("reads and updates the row addressed by a changing prop", async () => {
		const { store, useStore } = await setup();
		const Ticket = ({ rowKey }: { rowKey: string }) => {
			const [status, update] = useStore("tickets", rowKey, "status");

			return (
				<button type="button" onClick={() => update(() => "review")}>
					{status}
				</button>
			);
		};

		const { rerender } = await mount(<Ticket rowKey="1" />);

		expect(screen.getByRole("button").textContent).toBe("todo");

		await rerender(<Ticket rowKey="2" />);

		expect(screen.getByRole("button").textContent).toBe("done");

		await act(async () => {
			screen.getByRole("button").click();
		});

		expect(screen.getByRole("button").textContent).toBe("review");
		expect(store.read(["tickets", "1", "status"])).toBe("todo");
		expect(store.read(["tickets", "2", "status"])).toBe("review");
	});

	it("keeps an equal recipe silent after the row-key prop changes", async () => {
		const { store, useStore } = await setup();
		const rendered = vi.fn();
		const Ticket = ({ rowKey }: { rowKey: string }) => {
			const [row, update] = useStore("tickets", rowKey);
			rendered();
			return (
				<>
					<span>{row?.status}</span>
					<button type="button" onClick={() => update((draft) => ({ ...draft }))}>
						Equal
					</button>
					<button type="button" onClick={() => update((draft) => ({ ...draft, status: "review" }))}>
						Change
					</button>
				</>
			);
		};
		const { rerender } = await mount(<Ticket rowKey="1" />);
		await rerender(<Ticket rowKey="2" />);
		const before = rendered.mock.calls.length;
		await act(async () => screen.getByRole("button", { name: "Equal" }).click());
		expect(rendered).toHaveBeenCalledTimes(before);
		await act(async () => screen.getByRole("button", { name: "Change" }).click());
		expect(rendered.mock.calls.length).toBeGreaterThan(before);
		expect(store.read(["tickets", "1", "status"])).toBe("todo");
		expect(store.read(["tickets", "2", "status"])).toBe("review");
		expect(screen.getByText("review")).toBeDefined();
	});

	it("uses the returned nested object instead of draft mutations", async () => {
		const store = await createStore({
			schema: object({ tickets: array(object({ assignee: object({ name: string() }) })) }),
		});
		store.update(["tickets"], () => [{ key: "1", assignee: { name: "Ann" } }]);
		const useStore = use(Promise.resolve(store));
		const Assignee = () => {
			const [assignee, update] = useStore("tickets", "1", "assignee");
			return (
				<button
					type="button"
					onClick={() =>
						update((draft) => {
							draft.name = "Ignored";
							return { name: "Returned" };
						})
					}
				>
					{assignee?.name}
				</button>
			);
		};
		await mount(<Assignee />);
		await act(async () => screen.getByRole("button").click());
		expect(screen.getByRole("button").textContent).toBe("Returned");
		expect(store.read(["tickets", "1", "assignee", "name"])).toBe("Returned");
	});

	it("clears a scalar root when its updater returns undefined", async () => {
		const { store, useStore } = await setup();
		const Language = () => {
			const [language, update] = useStore("language");
			return (
				<button type="button" onClick={() => update(() => undefined)}>
					{language ?? "missing"}
				</button>
			);
		};
		await mount(<Language />);
		expect(screen.getByRole("button").textContent).toBe("en");
		await act(async () => screen.getByRole("button").click());
		expect(screen.getByRole("button").textContent).toBe("missing");
		expect(store.read(["language"])).toBeUndefined();
	});

	it("writes through the updater", async () => {
		const { store, useStore } = await setup();
		const Tickets = () => {
			const [rows, update] = useStore("tickets");
			const handleClick = () =>
				update((draft) => {
					draft.push({ key: "4", status: "todo" });
					return draft;
				});
			const invalid = () =>
				// @ts-expect-error The hook updater requires the next value.
				update((draft) => {
					draft.push({ key: "5", status: "todo" });
				});
			expectTypeOf(invalid).toBeFunction();

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
		expect(store.read(["tickets"]).at(-1)).toStrictEqual({ key: "4", status: "todo" });
	});

	it("infers readonly nested snapshots and writable recipes from the schema", async () => {
		const store = await createStore({
			schema: object({ tickets: array(object({ assignee: object({ name: string() }) })) }),
		});
		store.update(["tickets"], (rows) => {
			rows.push({ key: "1", assignee: { name: "Ann" } });
			return rows;
		});
		const useStore = use(Promise.resolve(store));
		const Assignee = () => {
			const [assignee, update] = useStore("tickets", "1", "assignee");
			expectTypeOf(assignee).toEqualTypeOf<{ readonly name: string } | undefined>();
			return (
				<button
					type="button"
					onClick={() =>
						update((draft) => {
							expectTypeOf(draft).toEqualTypeOf<{ name: string }>();
							draft.name = "Bob";
							return draft;
						})
					}
				>
					{assignee?.name}
				</button>
			);
		};

		await mount(<Assignee />);
		expect(screen.getByRole("button").textContent).toBe("Ann");
		await act(async () => {
			screen.getByRole("button").click();
		});
		expect(screen.getByRole("button").textContent).toBe("Bob");
		expect(store.read(["tickets", "1", "assignee", "name"])).toBe("Bob");
	});

	it("writes through the updater for a register", async () => {
		const { store, useStore } = await setup();
		const Language = () => {
			const [language, setLanguage] = useStore("language");

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
		expect(store.read(["language"])).toBe("cs");
	});

	it("refreshes a nested snapshot when a sibling field changes", async () => {
		const store = await createStore({
			schema: object({
				tickets: array(
					object({
						title: string(),
						assignee: object({ name: string(), key: string() }),
					}),
				),
			}),
		});
		store.update(["tickets"], (rows) => {
			rows.push({ key: "1", title: "First", assignee: { name: "Ann", key: "data" } });
			return rows;
		});
		const useStore = use(Promise.resolve(store));
		const rendered = vi.fn();
		const Assignee = () => {
			const [assignee, update] = useStore("tickets", "1", "assignee");
			expectTypeOf(assignee).toEqualTypeOf<{ readonly name: string; readonly key: string } | undefined>();
			rendered();
			return (
				<button
					type="button"
					onClick={() =>
						update((draft) => {
							expectTypeOf(draft.key).toEqualTypeOf<string>();
							draft.name = "Bob";
							draft.key = "changed";
							return draft;
						})
					}
				>
					{assignee?.name}
				</button>
			);
		};
		await mount(<Assignee />);
		const before = rendered.mock.calls.length;
		await act(async () => {
			store.update(["tickets", "1", "title"], () => "Second");
		});
		expect(rendered.mock.calls.length).toBeGreaterThan(before);
		expect(screen.getByRole("button").textContent).toBe("Ann");
		await act(async () => {
			screen.getByRole("button").click();
		});
		expect(rendered.mock.calls.length).toBeGreaterThan(before);
		expect(screen.getByRole("button").textContent).toBe("Bob");
		expect(store.read(["tickets", "1", "assignee", "key"])).toBe("changed");
	});

	it("resolves a retained setter after row deletion and replacement", async () => {
		const { store, useStore } = await setup();
		let retained: ((recipe: (value: string) => string) => void) | undefined;
		const Ticket = () => {
			const [status, update] = useStore("tickets", "1", "status");
			retained ??= update;
			return <span>{status ?? "missing"}</span>;
		};
		await mount(<Ticket />);
		const update = retained;
		if (!update) throw new Error("Expected updater");
		await act(async () => {
			store.update(["tickets"], (rows) => rows.filter((row) => row.key !== "1"));
		});
		const recipe = vi.fn(() => "review");
		expect(() => update(recipe)).toThrow("missing row");
		expect(recipe).not.toHaveBeenCalled();
		await act(async () => {
			store.update(["tickets"], (rows) => {
				rows.push({ key: "1", status: "fresh" });
				return rows;
			});
			update(recipe);
		});
		expect(recipe).toHaveBeenCalledTimes(1);
		expect(store.read(["tickets", "1", "status"])).toBe("review");
		expect(screen.getByText("review")).toBeDefined();
	});

	it("keeps its subscription across renders and unsubscribes on unmount", async () => {
		const { store, useStore } = await setup();
		const subscribe = store.subscribe.bind(store);
		const unsubscribed = vi.fn();
		const subscribed = vi.spyOn(store, "subscribe").mockImplementation((listener) => {
			const unsubscribe = subscribe(listener);
			return () => {
				unsubscribe();
				unsubscribed();
			};
		});
		const Ticket = ({ rowKey }: { rowKey: string }) => {
			const [status] = useStore("tickets", rowKey, "status");
			return <span>{status}</span>;
		};
		const { rerender, unmount } = await mount(<Ticket rowKey="1" />);

		await rerender(<Ticket rowKey="2" />);

		expect(subscribed).toHaveBeenCalledTimes(1);
		expect(unsubscribed).not.toHaveBeenCalled();

		await unmount();

		expect(unsubscribed).toHaveBeenCalledTimes(1);
	});

	it("infers the same store type as the store factory", async () => {
		const schema = object({ tickets: array(object({ title: string() })) });
		const store = await createStore({ schema });

		expectTypeOf(store).toEqualTypeOf<Store<DataFromSchema<typeof schema>>>();
	});
});
