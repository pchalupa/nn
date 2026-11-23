// @vitest-environment jsdom
import { array, type InferStateType, object, string } from "@nn/schema";
import { act, cleanup, render, screen } from "@testing-library/react";
import { startTransition, Suspense, useState, type ReactNode } from "react";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, expectTypeOf, it, vi } from "vitest";

import { createStore } from "./index";

const schema = object({
	tickets: array(object({ id: string(), title: string(), status: string() })),
	language: string(),
});

type Data = InferStateType<typeof schema>;

const setup = () => {
	const result = createStore(schema);
	const { store } = result;

	store.mutate((draft) => {
		draft.tickets.push(
			{ id: "1", title: "First", status: "todo" },
			{ id: "2", title: "Second", status: "done" },
			{ id: "3", title: "Third", status: "done" },
		);
		draft.language = "en";
	});

	return result;
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

	describe("useQuery", () => {
		it("renders selected items and updates only when their data changes", async () => {
			const { store, useQuery } = setup();
			const rendered = vi.fn();
			const Column = () => {
				const tickets = useQuery((data) => data.tickets.filter((ticket) => ticket.status === "todo"));

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
				store.mutate((draft) => {
					draft.tickets[1].title = "Elsewhere";
					draft.language = "cs";
				}),
			);
			expect(rendered).toHaveBeenCalledTimes(renders);
			expect(screen.getAllByRole("listitem")).toHaveLength(1);

			await act(async () =>
				store.mutate((draft) => {
					draft.tickets[0].title = "Changed";
				}),
			);
			expect(screen.getByText("Changed")).toBeDefined();
			expect(rendered.mock.calls.length).toBeGreaterThan(renders);
		});

		it("rerenders only the row whose ticket changed", async () => {
			const { store, useQuery } = setup();
			const rendered = vi.fn();
			const Row = ({ index }: { index: number }) => {
				const title = useQuery((data) => data.tickets[index].title);

				rendered(index);

				return <li>{title}</li>;
			};

			await mount(
				<ul>
					{[0, 1, 2].map((index) => (
						<Row key={index} index={index} />
					))}
				</ul>,
			);

			rendered.mockClear();

			await act(async () =>
				store.mutate((draft) => {
					draft.tickets[1].title = "Changed";
				}),
			);

			expect(rendered.mock.calls).toStrictEqual([[1]]);
		});

		it("uses a changed captured prop without requiring a store mutation", async () => {
			const { useQuery } = setup();
			const Column = ({ status }: { status: string }) => {
				const titles = useQuery((data) =>
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
			const { store, useQuery } = setup();
			const evaluated: string[] = [];
			const Column = ({ status }: { status: string }) => {
				const titles = useQuery((data) => {
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
				store.mutate((draft) => {
					draft.tickets[0].title = "Changed";
				}),
			);
			expect(evaluated[0]).toBe("todo");
			expect(screen.getByText("Changed")).toBeDefined();
		});

		it("infers scalar, derived, optional and readonly collection selections", async () => {
			const { useQuery, useMutation } = setup();
			const Typed = () => {
				const language = useQuery((data) => data.language);
				const count = useQuery((data) => data.tickets.length);
				const tickets = useQuery((data) => data.tickets);
				const ticket = useQuery((data) => data.tickets.find((item) => item.id === "missing"));
				const mutate = useMutation();

				expectTypeOf(language).toEqualTypeOf<string>();
				expectTypeOf(count).toEqualTypeOf<number>();
				expectTypeOf(tickets).toEqualTypeOf<
					ReadonlyArray<{ readonly id: string; readonly title: string; readonly status: string }>
				>();
				expectTypeOf(ticket).toEqualTypeOf<
					{ readonly id: string; readonly title: string; readonly status: string } | undefined
				>();
				expectTypeOf(mutate).toEqualTypeOf<(recipe: (draft: Data) => void) => void>();

				return <span>{`${language}:${count}:${ticket?.title ?? "missing"}`}</span>;
			};

			await mount(<Typed />);
			expect(screen.getByText("en:3:missing")).toBeDefined();
		});

		it("provides a server snapshot for a resolved store", async () => {
			const { useQuery } = setup();
			const Language = () => <span>{useQuery((data) => data.language)}</span>;

			await mount(<Language />);
			expect(renderToString(<Language />)).toBe("<span>en</span>");
		});

		it("keeps a stable selector's result without rerunning it when rerendered without a store change", async () => {
			const { useQuery } = setup();
			const selector = vi.fn((data: { readonly language: string }) => new Map([["language", data.language]]));
			const results: unknown[] = [];
			const Language = ({ pass }: { pass: number }) => {
				results.push(useQuery(selector));

				return <span>{pass}</span>;
			};
			const { rerender } = await mount(<Language pass={0} />);
			const calls = selector.mock.calls.length;

			await rerender(<Language pass={1} />);
			await rerender(<Language pass={2} />);

			expect(results.length).toBeGreaterThan(1);
			expect(new Set(results).size).toBe(1);
			expect(selector).toHaveBeenCalledTimes(calls);
		});
	});

	describe("useMutation", () => {
		it("keeps its identity across rerenders", async () => {
			const { useMutation } = setup();
			const mutations: unknown[] = [];
			const Writer = () => {
				mutations.push(useMutation());

				return null;
			};
			const { rerender } = await mount(<Writer />);

			await rerender(<Writer />);
			expect(mutations.length).toBeGreaterThan(1);
			expect(new Set(mutations).size).toBe(1);
		});

		it("updates a reading sibling without rerendering the writer", async () => {
			const { useQuery, useMutation } = setup();
			const rendered = vi.fn();
			const Writer = () => {
				const mutate = useMutation();

				rendered();

				return (
					<button
						type="button"
						onClick={() =>
							mutate((draft) => {
								draft.language = "cs";
							})
						}
					>
						Switch
					</button>
				);
			};
			const Label = () => <span>{useQuery((data) => data.language)}</span>;

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

		it("reads and writes a store without a suspense boundary", async () => {
			const { store, useQuery, useMutation } = createStore(schema);
			const Editor = () => {
				const mutate = useMutation();
				const language = useQuery((data) => data.language);

				return (
					<button
						type="button"
						onClick={() =>
							mutate((draft) => {
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
			expect(store.query((state) => state).language).toBe("cs");
			expect(screen.getByRole("button").textContent).toBe("cs");
		});
	});
});
