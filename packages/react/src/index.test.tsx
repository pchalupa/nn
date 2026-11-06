// @vitest-environment jsdom
import { array, type InferStateType, object, string } from "@nn/schema";
import { act, cleanup, render, screen } from "@testing-library/react";
import { startTransition, StrictMode, Suspense, useState, type ReactNode } from "react";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, expectTypeOf, it, vi } from "vitest";

import { createStore } from "./index";

const schema = object({
	tickets: array(object({ id: string(), title: string(), status: string() })),
	language: string(),
});

type Data = InferStateType<typeof schema>;

const setup = () => {
	const created = createStore(schema);

	created.store.state.update((draft) => {
		draft.tickets.push(
			{ id: "1", title: "First", status: "todo" },
			{ id: "2", title: "Second", status: "done" },
			{ id: "3", title: "Third", status: "done" },
		);
		draft.language = "en";
	});

	return created;
};

const mount = async (ui: ReactNode) => {
	const rendered = await act(async () => render(<Suspense fallback="loading">{ui}</Suspense>));

	return {
		rerender: (next: ReactNode) => act(async () => rendered.rerender(<Suspense fallback="loading">{next}</Suspense>)),
		unmount: () => act(async () => rendered.unmount()),
	};
};

describe("@nn/react", () => {
	afterEach(() => {
		cleanup();
	});

	describe("createStore", () => {
		it("creates a store with the schema defaults", () => {
			const { store } = createStore(schema);

			expect(store.state.read()).toStrictEqual({ tickets: [], language: "" });
			expectTypeOf(store.state.read().language).toEqualTypeOf<string>();
		});
	});

	describe("useRead", () => {
		it("renders selected rows and updates only when their data changes", async () => {
			const { store, useRead } = setup();
			const rendered = vi.fn();
			const Column = () => {
				const tickets = useRead((data) => data.tickets.filter((ticket) => ticket.status === "todo"));

				rendered();

				return (
					<ul>
						{tickets.map((ticket) => (
							<li key={ticket.id}>{ticket.title}</li>
						))}
					</ul>
				);
			};

			await mount(<Column />);
			const renders = rendered.mock.calls.length;

			await act(async () =>
				store.state.update((draft) => {
					draft.tickets[1].title = "Elsewhere";
					draft.language = "cs";
				}),
			);
			expect(rendered).toHaveBeenCalledTimes(renders);
			expect(screen.getAllByRole("listitem")).toHaveLength(1);

			await act(async () =>
				store.state.update((draft) => {
					draft.tickets[0].title = "Changed";
				}),
			);
			expect(screen.getByText("Changed")).toBeDefined();
			expect(rendered.mock.calls.length).toBeGreaterThan(renders);
		});

		it("does not rerender when none of several reads change", async () => {
			const { store, useRead } = setup();
			const rendered = vi.fn();
			const Summary = () => {
				const language = useRead((data) => data.language);
				const count = useRead((data) => data.tickets.length);
				const title = useRead((data) => data.tickets[0]?.title);

				rendered();

				return <span>{`${language}:${count}:${title}`}</span>;
			};

			await mount(<Summary />);
			await act(async () =>
				store.state.update((draft) => {
					draft.tickets[0].title = "Changed";
				}),
			);
			expect(screen.getByText("en:3:Changed")).toBeDefined();
			const renders = rendered.mock.calls.length;

			await act(async () =>
				store.state.update((draft) => {
					draft.tickets[1].title = "Elsewhere";
				}),
			);
			expect(rendered).toHaveBeenCalledTimes(renders);
		});

		it("uses a changed captured prop without requiring a store update", async () => {
			const { useRead } = setup();
			const Column = ({ status }: { status: string }) => {
				const titles = useRead((data) =>
					data.tickets.filter((ticket) => ticket.status === status).map((ticket) => ticket.title),
				);

				return <span>{titles.join(",")}</span>;
			};
			const { rerender } = await mount(<Column status="todo" />);

			expect(screen.getByText("First")).toBeDefined();
			await rerender(<Column status="done" />);
			expect(screen.getByText("Second,Third")).toBeDefined();
		});

		it("keeps the committed subscription's selector when a concurrent render suspends", async () => {
			const { store, useRead } = setup();
			const evaluated: string[] = [];
			const Column = ({ status }: { status: string }) => {
				const titles = useRead((data) => {
					evaluated.push(status);

					return data.tickets.filter((ticket) => ticket.status === status).map((ticket) => ticket.title);
				});

				if (status === "done") throw new Promise(() => {});

				return <span>{titles.join(",")}</span>;
			};
			const App = () => {
				const [status, setStatus] = useState("todo");

				return (
					<>
						<button type="button" onClick={() => startTransition(() => setStatus("done"))}>
							Switch
						</button>
						<Column status={status} />
					</>
				);
			};

			await mount(<App />);
			await act(async () => screen.getByRole("button").click());
			expect(evaluated).toContain("done");
			evaluated.length = 0;

			await act(async () =>
				store.state.update((draft) => {
					draft.tickets[0].title = "Changed";
				}),
			);
			expect(evaluated[0]).toBe("todo");
			expect(screen.getByText("Changed")).toBeDefined();
		});

		it("infers scalar, derived, optional and readonly collection selections", async () => {
			const { useRead, useUpdate } = setup();
			const Typed = () => {
				const language = useRead((data) => data.language);
				const count = useRead((data) => data.tickets.length);
				const tickets = useRead((data) => data.tickets);
				const ticket = useRead((data) => data.tickets.find((item) => item.id === "missing"));
				const update = useUpdate();

				expectTypeOf(language).toEqualTypeOf<string>();
				expectTypeOf(count).toEqualTypeOf<number>();
				expectTypeOf(tickets).toEqualTypeOf<
					ReadonlyArray<{ readonly id: string; readonly title: string; readonly status: string }>
				>();
				expectTypeOf(ticket).toEqualTypeOf<
					{ readonly id: string; readonly title: string; readonly status: string } | undefined
				>();
				expectTypeOf(update).toEqualTypeOf<(recipe: (draft: Data) => void) => void>();

				return <span>{`${language}:${count}:${ticket?.title ?? "missing"}`}</span>;
			};

			await mount(<Typed />);
			expect(screen.getByText("en:3:missing")).toBeDefined();
		});

		it("provides a server snapshot for a resolved store", async () => {
			const { useRead } = setup();
			const Language = () => <span>{useRead((data) => data.language)}</span>;

			await mount(<Language />);
			expect(renderToString(<Language />)).toBe("<span>en</span>");
		});

		it("keeps one live subscription through StrictMode and removes it on unmount", async () => {
			const { store, useRead } = setup();
			const subscribe = store.updates.subscribe.bind(store.updates);
			let active = 0;

			vi.spyOn(store.updates, "subscribe").mockImplementation((listener) => {
				active++;
				const unsubscribe = subscribe(listener);

				return () => {
					active--;
					unsubscribe();
				};
			});
			const Language = () => <span>{useRead((data) => data.language)}</span>;
			const { unmount, rerender } = await mount(
				<StrictMode>
					<Language />
				</StrictMode>,
			);

			expect(active).toBe(1);
			await rerender(
				<StrictMode>
					<Language />
				</StrictMode>,
			);
			expect(active).toBe(1);
			await unmount();
			expect(active).toBe(0);
		});
	});

	describe("useUpdate", () => {
		it("keeps its identity and never subscribes or rerenders on store changes", async () => {
			const { store, useUpdate } = setup();
			const subscribe = vi.spyOn(store.updates, "subscribe");
			const updates: unknown[] = [];
			const Writer = () => {
				updates.push(useUpdate());

				return null;
			};
			const { rerender } = await mount(
				<StrictMode>
					<Writer />
				</StrictMode>,
			);
			const renders = updates.length;

			await act(async () =>
				store.state.update((draft) => {
					draft.language = "cs";
				}),
			);
			expect(updates).toHaveLength(renders);

			await rerender(
				<StrictMode>
					<Writer />
				</StrictMode>,
			);
			expect(updates.length).toBeGreaterThan(renders);
			expect(new Set(updates).size).toBe(1);
			expect(subscribe).not.toHaveBeenCalled();
		});

		it("updates a reading sibling without rerendering the writer", async () => {
			const { useRead, useUpdate } = setup();
			const rendered = vi.fn();
			const Writer = () => {
				const update = useUpdate();

				rendered();

				return (
					<button
						type="button"
						onClick={() =>
							update((draft) => {
								draft.language = "cs";
							})
						}
					>
						Switch
					</button>
				);
			};
			const Label = () => <span>{useRead((data) => data.language)}</span>;

			await mount(
				<>
					<Writer />
					<Label />
				</>,
			);
			expect(screen.getByText("en")).toBeDefined();
			await act(async () => screen.getByRole("button").click());
			expect(screen.getByText("cs")).toBeDefined();
			expect(rendered).toHaveBeenCalledTimes(1);
		});

		it("rerenders a reading component that writes through its own updater", async () => {
			const { store, useRead, useUpdate } = setup();
			const Editor = () => {
				const language = useRead((data) => data.language);
				const update = useUpdate();

				return (
					<button
						type="button"
						onClick={() =>
							update((draft) => {
								draft.language = "cs";
							})
						}
					>
						{language}
					</button>
				);
			};

			await mount(<Editor />);
			expect(screen.getByRole("button").textContent).toBe("en");
			await act(async () => screen.getByRole("button").click());
			expect(screen.getByRole("button").textContent).toBe("cs");
			expect(store.state.read().language).toBe("cs");
		});

		it("writes against current state after its component unmounts", async () => {
			const { store, useUpdate } = setup();
			const updates: Array<(recipe: (draft: Data) => void) => void> = [];
			const Writer = () => {
				updates.push(useUpdate());

				return null;
			};
			const { unmount } = await mount(<Writer />);

			await unmount();
			store.state.update((draft) => {
				draft.tickets.splice(0, draft.tickets.length, { id: "4", title: "Fresh", status: "todo" });
			});
			updates[0]((draft) => {
				draft.tickets[0].title += " updated";
			});
			expect(store.state.read().tickets).toStrictEqual([{ id: "4", title: "Fresh updated", status: "todo" }]);
		});

		it("reads and writes a store without a suspense boundary", async () => {
			const { store, useRead, useUpdate } = createStore(schema);
			const Editor = () => {
				const update = useUpdate();
				const language = useRead((data) => data.language);

				return (
					<button
						type="button"
						onClick={() =>
							update((draft) => {
								draft.language = "cs";
							})
						}
					>
						{language || "empty"}
					</button>
				);
			};

			render(<Editor />);
			expect(screen.getByRole("button").textContent).toBe("empty");
			await act(async () => screen.getByRole("button").click());
			expect(store.state.read().language).toBe("cs");
			expect(screen.getByRole("button").textContent).toBe("cs");
		});
	});
});
