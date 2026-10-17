# TanStack Query React API and Suspense

Researched **2026-10-16** against the published `@tanstack/react-query@5.104.3` and `@tanstack/query-core@5.104.3`. The npm `latest` tag resolves to **5.104.3**, published 2026-10-15, so the current stable major is still **v5**, not v6. The release tag resolves to commit `ee47993724e5b71e65d9f38ae416367d2dd18395`. Published React package sources for `useBaseQuery`, `types`, and `useSuspenseQuery` match that commit. The package supports React 18 and 19. [Distribution metadata][npm] · [Release source][release]

The documentation URLs below are moving `latest` pages. Source links are pinned to the researched release, except the explicitly historical section. This is API research, not a recommendation to add TanStack Query to this repo.

## Main findings

- Use `useQuery` when the component should render pending, disabled, placeholder, or error states. Use `useSuspenseQuery` when a Suspense boundary should own missing-data loading and an error boundary should own errors without cached data. They share the same query cache and observer machinery. [Hook types][types] · [Implementation][base] · [Suspense guide][suspense]
- Suspense does **not** mean every refetch suspends or every error is thrown. Cached data remains visible during background fetching, including a failed background refetch by default. [Suspense guide][suspense] · [Error policy implementation][errors]
- Multiple Suspense hooks in one component start serially when uncached. `useSuspenseQueries` starts independent ordinary queries together; prefetching before rendering avoids many parent/child waterfalls. [Parallel queries][parallel] · [Prefetching][prefetch] · [Batch implementation][queries-source]
- **Removed, not merely experimental today:** `useQuery().promise` and `experimental_prefetchInRender` were removed in **5.102.0**. Older v5 examples using `React.use(query.promise)` do not describe 5.104.3. [Release changelog][changelog] · [Removal commit][promise-removal]
- **Still available but deprecated in 5.104.3:** `fetchQuery`, `prefetchQuery`, and `ensureQueryData`. The current imperative API is `queryClient.query`, with `queryClient.infiniteQuery` for infinite queries. Do not assume an older v5 tutorial covers the current API surface. [QueryClient source][client]

## 1. Hook and option differences

The following describes the public TypeScript API in **5.104.3**, not unsupported options forced through JavaScript. [Hook types][types] · [useSuspenseQuery][suspense-query] · [useSuspenseQueries][suspense-queries] · [useSuspenseInfiniteQuery][suspense-infinite]

| API                        | Missing data                                          | Successful data type                                                                                         | Disabled queries                      | Placeholder data        | Error policy                                  |
| -------------------------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | ------------------------------------- | ----------------------- | --------------------------------------------- |
| `useQuery`                 | Returns a pending result                              | Normally `TData` or `undefined`, narrowed by result state; defined `initialData` has a defined-data overload | `enabled` or `queryFn: skipToken`     | Supported               | Configurable `throwOnError`; false by default |
| `useSuspenseQuery`         | Suspends                                              | Defined `TData` on return                                                                                    | No `enabled`; no `skipToken`          | Not supported           | Fixed no-cached-data policy                   |
| `useSuspenseQueries`       | Starts missing queries together and suspends for them | Each result has defined data; optional `combine` can return another shape                                    | No per-query `enabled` or `skipToken` | Not supported per query | Same fixed policy per query                   |
| `useSuspenseInfiniteQuery` | Suspends for missing infinite-query data              | Defined `InfiniteData`, unless transformed with `select`                                                     | No `enabled`; no `skipToken`          | Not supported           | Same fixed policy                             |

The Suspense variants omit `enabled`, `placeholderData`, and `throwOnError`; their query function excludes `skipToken`. Ordinary `useQuery` also has no public `suspense: true` option in v5: choose the dedicated hook. `initialData`, `select`, `staleTime`, retry options, and background-refetch options remain available to the single Suspense hooks. `useSuspenseQueries` accepts `queries` and `combine`, but not the top-level `subscribed` option of `useQueries`. [Hook types][types] · [Single-hook implementation][single-source] · [Batch implementation][batch-source]

Defined data is a contract for a well-formed query result, not validation of arbitrary selectors. A query function must not resolve `undefined`; use `null` for an intentional empty result. A selector whose own return type includes `undefined` can undermine the useful defined-data type, and `select` is not the place to validate or throw query-fetch errors. Validate in the query function instead. [useQuery reference][query] · [Generic result types][types] · [Render optimizations][render]

### Disabled and skipped queries

With `enabled: false`, an uncached query starts as `status: 'pending'`, `fetchStatus: 'idle'`. It does not automatically fetch or respond to invalidation with a refetch; `refetch()` can still run a supplied query function manually. `skipToken` provides type-safe disabling by replacing the function, but `refetch()` cannot execute that missing function. Neither mechanism is a Suspense-hook escape hatch. Conditionally render a child that calls the Suspense hook instead of conditionally calling a hook. [Disabling queries][disabled] · [Suspense options][types]

## 2. Status, loading, and background work

`status` answers what happened to the data; `fetchStatus` answers whether a fetch is running. They are separate state dimensions. The status values in v5 are `pending`, `success`, and `error`, not the v4 `loading` status. [Queries guide][query-states] · [v5 migration][migration]

| Property         | Meaning in an ordinary query result                                               |
| ---------------- | --------------------------------------------------------------------------------- |
| `isPending`      | `status === 'pending'`, before successful data or a terminal error                |
| `isFetching`     | `fetchStatus === 'fetching'`, including initial fetch and background work         |
| `isLoading`      | `isPending && isFetching`, an initial fetch actually in flight                    |
| `isRefetching`   | `isFetching && !isPending`                                                        |
| `isLoadingError` | Error with no data                                                                |
| `isRefetchError` | Error while still holding data                                                    |
| `fetchStatus`    | `fetching`, `paused`, or `idle`; an offline query can want to fetch but be paused |

These formulas come from the observer. `isInitialLoading` is a deprecated alias of `isLoading`. A disabled uncached query can be pending without loading; an errored refetch can have both `data` and `error`. [Observer implementation][observer] · [useQuery result reference][query] · [Disabling queries][disabled]

When a Suspense hook returns, its result type is a success or refetch-error result, not a pending result. It omits `isPlaceholderData`; `isPending` and `isLoading` are false in the defined-result variants. `isFetching`, `isRefetching`, `error`, and `isRefetchError` still matter. A stale cached result alone does not suspend: the hook suspends when its optimistic result is pending. [Result types][types] · [Suspension predicate][suspense-source] · [Observer result unions][core-types]

Ordinary queries have `staleTime: 0` by default and can refetch stale data on mount, focus, and reconnect. In **5.104.3**, Suspense internally clamps `staleTime` and a numeric `gcTime` to at least **1,000 ms** to reduce repeated work on remount; a `'static'` stale time is preserved. This is an implementation detail, not a reason to rely on one second as application policy. Set a suitable `staleTime` explicitly. Observer retries default to three on the client and zero on the server, so an initial error usually reaches a boundary only after retries finish. [Defaults][defaults] · [Suspense timers][suspense-source] · [Retry defaults][query]

## 3. Error policy and recovery

The fixed Suspense predicate is equivalent to `(_error, query) => query.state.data === undefined`. An initial terminal fetch failure is thrown to an error boundary. A failed refetch with cached data normally returns that data and an error result instead. The implementation waits until fetching has stopped before throwing and checks whether the error boundary has been reset. [Suspense guide][suspense] · [Default predicate][suspense-source] · [Throwing checks][errors]

If every settled error should replace the page, explicitly throw `error` when `error && !isFetching`. For `useQuery`, `throwOnError: true` or a predicate can select boundary handling directly. Do not copy the general reference's broad wording about all Suspense errors being thrown: the dedicated guide and fixed predicate specify the cached-data exception. [Suspense guide][suspense] · [useQuery options][query] · [Implementation][errors]

`QueryErrorResetBoundary` and the React error boundary solve different problems. The React boundary controls the fallback and remount. TanStack's boundary supplies a reset flag that lets query observers retry instead of immediately throwing the same failure. Wire `ErrorBoundary.onReset` to TanStack's `reset`, and invoke `resetErrorBoundary()` from the retry button, as in the official example. Resetting only the React boundary is not the documented retry integration. [Official reset example][suspense] · [Reset flag source][reset-source] · [Retry prevention][errors]

`reset()` does not itself clear query data, remove cache entries, call `queryClient.resetQueries`, or fetch. It flips a scoped flag; remount and query retry behavior do the work. The flag is cleared after mount or a failed optimistic fetch. `useQueryErrorResetBoundary()` accesses the closest boundary; without one it uses the shared default context. This distinction matters when several views share a query. [Reset implementation][reset-source] · [Retry/reset checks][errors] · [Optimistic fetch][suspense-source]

## 4. Typed query options and a complete boundary example

`queryOptions` returns its argument unchanged at runtime. Its types preserve inference between the query key, function, and cached data, including typed `getQueryData(options.queryKey)` and `setQueryData`. Keep reusable key/function configuration in an options factory; add observer-specific `select` at the consuming hook. `select` changes the returned view, not what the query cache stores. The key's data tag describes the fetched cache data, not a particular observer's selection. Use `infiniteQueryOptions` for the corresponding infinite-query factory. [Query options guide][options] · [Factory implementation][options-source] · [Render optimizations][render]

The examples below share these definitions. The app must provide `GET /api/todos/:id` returning `{ id: number, title: string }`; fetch failures and malformed data become query errors. The validation avoids trusting the response shape. [Query-function contract][query]

```tsx
import {
	QueryClient,
	QueryClientProvider,
	QueryErrorResetBoundary,
	queryOptions,
	skipToken,
	usePrefetchQuery,
	useQuery,
	useSuspenseInfiniteQuery,
	useSuspenseQueries,
	useSuspenseQuery,
} from "@tanstack/react-query";
import { Suspense, useState, useTransition } from "react";
import { ErrorBoundary } from "react-error-boundary";

type Todo = { id: number; title: string };

async function fetchTodo(id: number, origin?: string): Promise<Todo> {
	const path = `/api/todos/${id}`;
	const response = await fetch(origin === undefined ? path : new URL(path, origin));
	if (!response.ok) throw new Error(`Request failed: ${response.status}`);
	const value: unknown = await response.json();
	if (
		typeof value !== "object" ||
		value === null ||
		!("id" in value) ||
		typeof value.id !== "number" ||
		!("title" in value) ||
		typeof value.title !== "string"
	) {
		throw new Error("Invalid todo");
	}
	return { id: value.id, title: value.title };
}

function todoOptions(id: number) {
	return queryOptions({
		queryKey: ["todo", id],
		queryFn: () => fetchTodo(id),
		staleTime: 60_000,
	});
}

function TodoPanel({ id }: { id: number }) {
	const { data, error, isFetching } = useSuspenseQuery(todoOptions(id));
	if (error && !isFetching) throw error;
	return (
		<h1>
			{data.title}
			{isFetching ? " (refreshing)" : ""}
		</h1>
	);
}

function TodoScreen({ id }: { id: number }) {
	return (
		<QueryErrorResetBoundary>
			{({ reset }) => (
				<ErrorBoundary
					onReset={reset}
					resetKeys={[id]}
					fallbackRender={({ resetErrorBoundary }) => <button onClick={() => resetErrorBoundary()}>Try again</button>}
				>
					<Suspense fallback={<p>Loading todo</p>}>
						<TodoPanel id={id} />
					</Suspense>
				</ErrorBoundary>
			)}
		</QueryErrorResetBoundary>
	);
}

const browserClient = new QueryClient();

export function BrowserApp() {
	return (
		<QueryClientProvider client={browserClient}>
			<TodoScreen id={1} />
		</QueryClientProvider>
	);
}
```

This client singleton is **browser-only**, not a server request cache. `resetKeys={[id]}` additionally lets `react-error-boundary` leave its existing fallback when the selected identity changes; `onReset` still connects that reset to TanStack. Remove the explicit `throw` in `TodoPanel` to use the default stale-data-on-refetch-error behavior. [SSR isolation][ssr] · [TanStack reset example][suspense] · [react-error-boundary implementation][react-boundary]

A non-Suspense view can handle a missing input and loading locally. In this example `skipToken` narrows `id` for the fetcher without a cast or non-null assertion. [Disabling queries][disabled] · [useQuery reference][query]

```tsx
function OptionalTodo({ id }: { id: number | undefined }) {
	const query = useQuery({
		queryKey: ["todo", id],
		queryFn: id === undefined ? skipToken : () => fetchTodo(id),
	});

	if (id === undefined) return <p>Select a todo</p>;
	if (query.isPending) return <p>Waiting for data</p>;
	if (query.isError) return <p>{query.error.message}</p>;
	return <h1>{query.data.title}</h1>;
}

function TodoTitle() {
	const { data } = useSuspenseQuery({
		...todoOptions(1),
		select: (todo) => todo.title,
	});
	return <h1>{data}</h1>;
}

function readCachedTodo(client: QueryClient) {
	return client.getQueryData(todoOptions(1).queryKey);
}
```

`TodoTitle.data` is inferred as `string`; `readCachedTodo` returns `Todo | undefined` without explicit generics. These are distinct selected and cached types. [Options inference][options-source] · [Cache read typing][client]

## 5. Parallel queries, dependent queries, and waterfalls

Two uncached `useSuspenseQuery` calls in the same component are serial: the first suspends before React executes the second. This can be correct for a dependency, such as fetching a user and then fetching projects using the user's ID. The second hook receives a defined first result, so it does not need `enabled`. A real dependency remains a network waterfall; changing hooks cannot remove the dependency. Flatten the server API or prefetch when the required inputs are already known. [Suspense guide][suspense] · [Dependent queries][dependent] · [Request waterfalls][waterfalls]

Use `useSuspenseQueries` for independent ordinary queries, including a dynamic array. It initiates the pending queries before throwing `Promise.all` and returns matching results, or the value of `combine`. With the default result it returns an array, not one aggregate query state. It does not incrementally reveal faster results: the component resumes after all missing results settle, then an error that needs throwing goes to the boundary. Use separate reveal boundaries when independent sections should appear separately. [useSuspenseQueries reference][suspense-queries] · [Batch suspension implementation][queries-source]

```tsx
function TwoTodos() {
	const [first, second] = useSuspenseQueries({
		queries: [todoOptions(1), todoOptions(2)],
	});
	return (
		<p>
			{first.data.title} / {second.data.title}
		</p>
	);
}

function PrefetchedScreen() {
	usePrefetchQuery(todoOptions(1));
	usePrefetchQuery(todoOptions(2));
	return (
		<Suspense fallback={<p>Loading both todos</p>}>
			<TwoTodos />
		</Suspense>
	);
}
```

Provide the query client and error boundary around this example as in `BrowserApp`. `usePrefetchQuery` starts work during the parent's render, before the child can suspend; it returns nothing and does not subscribe to query updates. In 5.104.3 it only starts when there is **no query state at all**, so it is not an automatic stale-data refresher or error retry hook. A prior pending or error entry also skips its prefetch. [Hook reference][prefetch-hook] · [Hook implementation][prefetch-source]

Parent/child component structure and lazy code loading can create additional waterfalls even if an individual component uses parallel queries. Router loaders, interaction-time prefetching, or hoisting requests can start work sooner. The `useSuspenseQueries` reference also warns that a fast result may already be stale when the slowest finishes, causing a mount refetch; use a long enough `staleTime`, not just the internal one-second minimum. [Request waterfalls][waterfalls] · [Prefetching][prefetch] · [Batch caveat][suspense-queries]

## 6. Imperative prefetch and cache guarantees

These APIs still exist in **5.104.3**, but the source marks all three below deprecated for removal in the next major. Their return and error behavior are different. [QueryClient source][client]

| API                        | Cache and fetch behavior                                                    | Return and errors                                                                                                                                   |
| -------------------------- | --------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `fetchQuery(options)`      | Uses cached data if fresh under the supplied `staleTime`, otherwise fetches | `Promise<TData>`; rejects on failure; does not retry by default                                                                                     |
| `prefetchQuery(options)`   | Same fetch/cache decision as `fetchQuery`                                   | `Promise<void>`; discards data and swallows fetch errors                                                                                            |
| `ensureQueryData(options)` | Returns existing cached data even if stale; fetches if data is missing      | `Promise<TData>`; missing-data fetch can reject; `revalidateIfStale: true` returns cached data while starting a swallowed-error background prefetch |

`ensureQueryData` defaults to no stale revalidation. `staleTime` on a prefetch controls whether the prefetch runs, but the consuming hook still needs its own freshness policy. Prefetches with no later observers are subject to cache garbage collection. `usePrefetchQuery` is not deprecated here; its current implementation uses the new API. [QueryClient implementation][client] · [Prefetching guide][prefetch] · [Prefetch hook][prefetch-source]

The replacement `queryClient.query(options)` returns cached fresh data or fetches stale/missing data, supports `select` on the returned value, rejects errors, and disables retries by default unless configured. It excludes observer-only options such as `enabled`, `placeholderData`, and `throwOnError`. `queryClient.query({ ...options, staleTime: 'static' })` is the documented replacement for ensuring cached data; `'static'` treats existing data as fresh even after invalidation, but missing data still fetches. This does **not** reproduce `revalidateIfStale: true`; start background revalidation separately when that is required. [QueryClient implementation][client] · [Static freshness check][query-source]

```tsx
async function warmTodo(client: QueryClient, id: number): Promise<void> {
	await client.prefetchQuery(todoOptions(id));
}

async function requireTodo(client: QueryClient, id: number) {
	return client.ensureQueryData({
		...todoOptions(id),
		revalidateIfStale: true,
	});
}

async function loadTodoNow(client: QueryClient, id: number) {
	return client.query(todoOptions(id));
}

async function requireCachedTodo(client: QueryClient, id: number) {
	return client.query({ ...todoOptions(id), staleTime: "static" });
}

function prefetchOnHover(client: QueryClient, id: number) {
	void client.query(todoOptions(id)).catch(() => undefined);
}
```

The first two functions intentionally demonstrate supported **deprecated** APIs; the others use the current API. Swallow errors only for speculative work. An awaited route load that must decide between content and an error response should handle rejection rather than silently convert it to a successful load. [QueryClient API][client] · [SSR error handling][ssr]

## 7. Key changes and React transitions

A new uncached query key can suspend again and replace visible content with the nearest fallback. Suspense queries do not support `placeholderData: keepPreviousData`. Wrap the **state update that changes the key** in `startTransition`, or the callback from `useTransition`, to keep already revealed content visible while React prepares the new view. This does not prevent the first mount's fallback, and it does not make a request unnecessary. [Suspense guide][suspense] · [React transition behavior][react-suspense]

```tsx
function TodoPicker() {
	const [id, setId] = useState(1);
	const [isPending, startTransition] = useTransition();

	return (
		<>
			<button disabled={isPending} onClick={() => startTransition(() => setId((current) => current + 1))}>
				{isPending ? "Opening next todo" : "Next todo"}
			</button>
			<TodoScreen id={id} />
		</>
	);
}
```

Here `isPending` is React transition state, not the query's `isPending`. Avoid keying the Suspense boundary by `id` if the goal is to preserve its previously revealed content: a changed React `key` intentionally creates a new boundary identity. Use that reset when the new content is conceptually a different screen and should show a fresh fallback. [React Suspense guidance][react-suspense]

## 8. Infinite-query constraints

`useSuspenseInfiniteQuery` gives defined initial infinite data, not an automatically complete list. `data.pages` holds the fetched pages and `data.pageParams` holds their corresponding parameters. The hook requires `initialPageParam` and `getNextPageParam`; return `undefined` or `null` from the latter when there is no next page. `getPreviousPageParam` supports the reverse direction. Initial/cache data must retain the infinite-data structure. [Infinite queries guide][infinite] · [Hook reference][suspense-infinite] · [Core option types][core-types]

Fetch more pages with `fetchNextPage`, observing `hasNextPage`, `isFetchingNextPage`, and overall `isFetching`. Existing data means loading another page is normally not a missing-data suspension. Pages share one query cache entry; do not issue unguarded page loads while another fetch is running. The safe UI condition in the official example is `hasNextPage && !isFetching`. [Infinite queries guide][infinite] · [Infinite observer result types][core-types]

`fetchNextPage` defaults `cancelRefetch` to true, so a new invocation can cancel/replace current work. With `cancelRefetch: false`, current in-flight work is reused rather than starting another independent page fetch. The guide's phrase about enabling simultaneous fetching should not be read as a guarantee of concurrent page requests for one cache entry. [Fetch-next-page option types][core-types] · [Query fetch implementation][query-source]

```tsx
type TodoPage = { items: Todo[]; nextCursor: number | null };

async function fetchTodoPage(cursor: number): Promise<TodoPage> {
	const items = await Promise.all([fetchTodo(cursor), fetchTodo(cursor + 1)]);
	return { items, nextCursor: cursor < 9 ? cursor + 2 : null };
}

function InfiniteTodos() {
	const query = useSuspenseInfiniteQuery({
		queryKey: ["todo-pages"],
		initialPageParam: 1,
		queryFn: ({ pageParam }) => fetchTodoPage(pageParam),
		getNextPageParam: (lastPage) => lastPage.nextCursor,
		staleTime: 60_000,
	});

	return (
		<>
			{query.data.pages.flatMap((page) => page.items.map((todo) => <p key={todo.id}>{todo.title}</p>))}
			<button
				disabled={!query.hasNextPage || query.isFetching}
				onClick={() => {
					if (query.hasNextPage && !query.isFetching) void query.fetchNextPage();
				}}
			>
				{query.isFetchingNextPage ? "Loading more" : "Load more"}
			</button>
		</>
	);
}
```

This small example uses two todo requests as one page and stops after IDs 9 and 10. It needs the same outer provider and boundaries as the earlier examples. Real cursor APIs should return their own next cursor. [Infinite-query pattern][infinite]

On a stale refetch, stored pages are fetched **sequentially from the first retained page** to avoid deriving later requests from stale cursors. A positive `maxPages` bounds the number retained and evicts a page from the opposite end when another is added; set suitable next/previous parameter functions for the directions that must work after eviction. v5 removed per-page `refetchPage` and manual `pageParam` overrides for `fetchNextPage`; use the parameter functions and `maxPages` model instead. [Infinite queries][infinite] · [v5 migration][migration] · [Infinite behavior][infinite-source]

There is no `useSuspenseInfiniteQueries` combined hook in this API. The reference warns that multiple infinite Suspense hooks cannot be parallelized in one suspending component by simply placing them next to each other. That is not a ban on starting distinct infinite queries with imperative prefetching or separate component boundaries; it is a limitation of the combined hook pattern. [Hook reference][suspense-infinite] · [Prefetching infinite queries][prefetch]

## 9. Cancellation limitations

The official limitation is explicit: cancellation does not work with `useSuspenseQuery`, `useSuspenseQueries`, or `useSuspenseInfiniteQuery`. Do not promise that unmounting a fallback or switching keys will abort its network work. This is separate from page-load `cancelRefetch` options and does not mean the underlying transport cannot support abort signals. [Cancellation guide][cancellation] · [Suspense hook reference][suspense-query]

For ordinary queries, the query function receives an `AbortSignal`. Passing it to `fetch` lets cancellation reach the transport. By default, an unused unresolved query may finish and populate the cache; consuming the signal enables abort/revert behavior when the last observer is removed. Manual `queryClient.cancelQueries` is also documented for ordinary queries. Do not generalize those guarantees to Suspense hooks. [Cancellation guide][cancellation] · [Observer removal][query-source]

## 10. SSR, hydration, and streaming

The established SSR pattern is a request-local `QueryClient`, server prefetching, `dehydrate`, then `HydrationBoundary` under a client provider. Server rendering and client hydration must start from compatible data. A server-global query client can leak data between users. Set a positive `staleTime` when appropriate to avoid an immediate client refetch, and keep the browser client stable across an initial render that suspends. [SSR guide][ssr] · [Advanced SSR][advanced]

Traditional SSR guidance uses `useQuery`. It permits `useSuspenseQuery` **if all queries are prefetched**, while warning that an omitted prefetch can cause framework-dependent duplicate fetching or markup hydration mismatches. Suspense alone does not supply cache dehydration or transport. Default dehydration includes successful queries, not failed ones; critical server loads should handle fetch rejection explicitly. Serialize embedded state safely against script injection rather than injecting raw JSON into HTML. [SSR guide][ssr] · [Hydration implementation][hydration]

The following awaited prefetch example uses current 5.104.3 APIs. `prepareTodoState` runs per request; its caller supplies a trusted absolute API origin for the server fetch. Pass the returned state through the framework's supported, safely serialized data channel. `HydratedTodo` still needs the client-side `QueryClientProvider`. In an authenticated app, use a request-scoped server fetcher with the appropriate credentials rather than assuming the browser's session is present. [SSR setup][ssr] · [QueryClient API][client]

```tsx
import { dehydrate, HydrationBoundary, type DehydratedState } from "@tanstack/react-query";

async function prepareTodoState(id: number, origin: string) {
	const client = new QueryClient();
	await client.query({
		...todoOptions(id),
		queryFn: () => fetchTodo(id, origin),
	});
	return dehydrate(client);
}

function HydratedTodo({ id, state }: { id: number; state: DehydratedState }) {
	return (
		<HydrationBoundary state={state}>
			<TodoScreen id={id} />
		</HydrationBoundary>
	);
}
```

### Framework streaming without the experimental package

The Server Components guide documents pending-query dehydration since **v5.40.0**. Include pending queries with `shouldDehydrateQuery`, start the prefetch without awaiting it, and pass the state through `HydrationBoundary`. In Next.js Server Components, React can transport those promises; the client cache adopts the promise, and `useSuspenseQuery` can suspend on it. This does not require the removed public `useQuery().promise` API. A plain JSON payload cannot carry live promises. [Advanced SSR streaming][advanced] · [Hydration source][hydration]

This path depends on framework promise transport and boundary placement, not a general promise-streaming guarantee for every SSR framework. With already awaited data, streaming can also happen as each server Suspense boundary finishes. Keep server-owned rendered data separate from independently revalidating client-owned data to avoid inconsistent views. Do not persist pending promises to ordinary storage; the guide recommends persisting only successful queries. [Advanced SSR guide][advanced]

### Experimental Next.js integration

`@tanstack/react-query-next-experimental` with `ReactQueryStreamedHydration` is **still explicitly experimental** in the researched docs. It supports fetching from client components during server rendering with `useSuspenseQuery` and streaming results as boundaries resolve, without explicit prefetching. It is a separate integration, not the baseline guarantee of `@tanstack/react-query`. [Suspense server integration][suspense] · [Advanced SSR experimental section][advanced] · [Package source][next-package]

The guide warns that this approach can reintroduce client-navigation waterfalls and needs a stable browser query client. Without a Suspense boundary, the response can wait for the fetch before starting, harming time to first byte. Evaluate it with the target Next.js/React versions rather than treating it as equivalent to the established prefetch/dehydrate approach. [Advanced SSR caveats][advanced]

## 11. Historical experimental API: removed in 5.102.0

In **5.101.4**, the official guide documented `useQuery().promise` plus `React.use`, enabled by `experimental_prefetchInRender: true` in query defaults. The parent could start a non-Suspense query and pass its result to a child that consumed the query-managed promise under Suspense. The result type described the promise as stable. The feature flag enabled render-time fetching, so it was not equivalent to constructing a fresh promise in every component render. [Historical guide][historical-guide] · [Historical result and flag types][historical-types] · [Historical hook implementation][historical-base]

**Do not use this with current 5.104.3.** The 5.102.0 changelog and removal commit explicitly remove both the render-time prefetch feature and the result `promise` property. This is a concrete example of an experimental API changing within v5. Current render-time prefetching should use the supported `usePrefetchQuery`/`usePrefetchInfiniteQuery` hooks, and normal query suspension should use the dedicated Suspense hooks. [Changelog][changelog] · [Removal commit][promise-removal] · [Current prefetch hook][prefetch-source] · [Current result types][core-types]

React's own `use(promise)` remains a separate React API. The removal is of TanStack's experimental integration and query result property, not React's ability to consume a suitable externally managed promise. Pending-query dehydration for Server Components and the experimental Next.js package are also separate features and remain documented. [React use][react-use] · [Advanced SSR][advanced] · [Removal commit][promise-removal]

## 12. Relevant observations for `@nn/react`

These are design takeaways, not implementation changes or claims that the libraries have the same responsibilities.

- The inspected working-tree [`packages/react/src/index.ts`](../../../packages/react/src/index.ts) consumes a `Promise<Store<Data>>` with React `use`, then reads paths through `useSyncExternalStore`. Its returned `[value, update]` models readiness outside the value, rather than exposing a query-like pending/error union. A dedicated ready-only API can be useful, but its failure and retry behavior needs an explicit owner, just as TanStack's Suspense hook requires boundaries. [TanStack hook contract][suspense-query]
- Retrying TanStack queries works because the query cache owns fetch execution and can retry after reset. Resetting a React boundary around an already rejected `Promise<Store<Data>>` does not itself create a replacement promise or restart store initialization. If retry is needed, the store-loading owner must supply that behavior. This follows from the local hook's direct promise consumption and TanStack's separate reset/retry mechanism. [Local hook](../../../packages/react/src/index.ts) · [React use][react-use] · [Reset source][reset-source] · [Retry checks][errors]
- Start independent initialization work before a component consumes the first promise. Otherwise the same render suspension that creates TanStack waterfalls can delay later work. Distinguish promise creation from promise consumption when reviewing an API. [Local hook](../../../packages/react/src/index.ts) · [Parallel-query warning][parallel] · [Prefetching][prefetch]
- Do not transfer the query-key transition example to external-store mutations without checking React's constraints. React documents that external-store mutations cannot be marked as non-blocking transitions and discourages suspending based on `useSyncExternalStore` values. The local store's update path is not the same as changing React state that selects a TanStack query key. [Local hook](../../../packages/react/src/index.ts) · [React external-store caveats][react-store] · [TanStack key-change guidance][suspense]

## 13. Verification and limits

- Version status comes from the registry's live `dist-tags` and publication time, cross-checked against the official release tag and published source. `latest` can change after this research date. [Distribution metadata][npm] · [Pinned package][release]
- The current and historical behavior above was checked against TanStack's guides, typed public API, implementation, and changelog, not inferred from the major version alone. In particular, the imperative API deprecations and experimental-promise removal need version-aware guidance. [QueryClient][client] · [Changelog][changelog]
- All seven TypeScript/TSX code blocks were extracted together and passed a strict, no-emit TypeScript check using TypeScript 6.0.3, React 19.2.1, `@types/react` 19.2.3, `react-error-boundary` 4.1.2, and TanStack Query 5.104.3 in an isolated temporary directory. They contain no casts, explicit untyped escape hatches, or code comments. The app-specific API endpoint and SSR execution were not run.
- Small runtime checks also confirmed imperative cache/freshness/selection behavior, error swallowing by deprecated `prefetchQuery`, and the absence of `promise` on a current query-observer result. These do not substitute for React rendering or SSR tests.
- Framework SSR and streaming guarantees depend on the chosen framework, React version, transport, and boundary layout. This note does not claim a browser or SSR end-to-end test. [SSR caveats][ssr] · [Advanced SSR][advanced]
- Local observations refer to the inspected working tree, which already had uncommitted edits. They are not a description of the last committed API. No application or library source was changed for this research.

## Sources

[npm]: https://registry.npmjs.org/@tanstack/react-query
[release]: https://github.com/TanStack/query/blob/ee47993724e5b71e65d9f38ae416367d2dd18395/packages/react-query/package.json
[suspense]: https://tanstack.com/query/latest/docs/framework/react/guides/suspense
[query]: https://tanstack.com/query/latest/docs/framework/react/reference/useQuery
[suspense-query]: https://tanstack.com/query/latest/docs/framework/react/reference/useSuspenseQuery
[suspense-queries]: https://tanstack.com/query/latest/docs/framework/react/reference/useSuspenseQueries
[suspense-infinite]: https://tanstack.com/query/latest/docs/framework/react/reference/useSuspenseInfiniteQuery
[query-states]: https://tanstack.com/query/latest/docs/framework/react/guides/queries
[defaults]: https://tanstack.com/query/latest/docs/framework/react/guides/important-defaults
[disabled]: https://tanstack.com/query/latest/docs/framework/react/guides/disabling-queries
[parallel]: https://tanstack.com/query/latest/docs/framework/react/guides/parallel-queries
[dependent]: https://tanstack.com/query/latest/docs/framework/react/guides/dependent-queries
[waterfalls]: https://tanstack.com/query/latest/docs/framework/react/guides/request-waterfalls
[options]: https://tanstack.com/query/latest/docs/framework/react/guides/query-options
[prefetch]: https://tanstack.com/query/latest/docs/framework/react/guides/prefetching
[prefetch-hook]: https://tanstack.com/query/latest/docs/framework/react/reference/usePrefetchQuery
[render]: https://tanstack.com/query/latest/docs/framework/react/guides/render-optimizations
[infinite]: https://tanstack.com/query/latest/docs/framework/react/guides/infinite-queries
[cancellation]: https://tanstack.com/query/latest/docs/framework/react/guides/query-cancellation
[migration]: https://tanstack.com/query/latest/docs/framework/react/guides/migrating-to-v5
[ssr]: https://tanstack.com/query/latest/docs/framework/react/guides/ssr
[advanced]: https://tanstack.com/query/latest/docs/framework/react/guides/advanced-ssr
[types]: https://github.com/TanStack/query/blob/ee47993724e5b71e65d9f38ae416367d2dd18395/packages/react-query/src/types.ts
[core-types]: https://github.com/TanStack/query/blob/ee47993724e5b71e65d9f38ae416367d2dd18395/packages/query-core/src/types.ts
[base]: https://github.com/TanStack/query/blob/ee47993724e5b71e65d9f38ae416367d2dd18395/packages/react-query/src/useBaseQuery.ts
[single-source]: https://github.com/TanStack/query/blob/ee47993724e5b71e65d9f38ae416367d2dd18395/packages/react-query/src/useSuspenseQuery.ts
[batch-source]: https://github.com/TanStack/query/blob/ee47993724e5b71e65d9f38ae416367d2dd18395/packages/react-query/src/useSuspenseQueries.ts
[queries-source]: https://github.com/TanStack/query/blob/ee47993724e5b71e65d9f38ae416367d2dd18395/packages/react-query/src/useQueries.ts
[suspense-source]: https://github.com/TanStack/query/blob/ee47993724e5b71e65d9f38ae416367d2dd18395/packages/react-query/src/suspense.ts
[errors]: https://github.com/TanStack/query/blob/ee47993724e5b71e65d9f38ae416367d2dd18395/packages/react-query/src/errorBoundaryUtils.ts
[reset-source]: https://github.com/TanStack/query/blob/ee47993724e5b71e65d9f38ae416367d2dd18395/packages/react-query/src/QueryErrorResetBoundary.tsx
[options-source]: https://github.com/TanStack/query/blob/ee47993724e5b71e65d9f38ae416367d2dd18395/packages/react-query/src/queryOptions.ts
[client]: https://github.com/TanStack/query/blob/ee47993724e5b71e65d9f38ae416367d2dd18395/packages/query-core/src/queryClient.ts
[observer]: https://github.com/TanStack/query/blob/ee47993724e5b71e65d9f38ae416367d2dd18395/packages/query-core/src/queryObserver.ts
[query-source]: https://github.com/TanStack/query/blob/ee47993724e5b71e65d9f38ae416367d2dd18395/packages/query-core/src/query.ts
[infinite-source]: https://github.com/TanStack/query/blob/ee47993724e5b71e65d9f38ae416367d2dd18395/packages/query-core/src/infiniteQueryBehavior.ts
[prefetch-source]: https://github.com/TanStack/query/blob/ee47993724e5b71e65d9f38ae416367d2dd18395/packages/react-query/src/usePrefetchQuery.tsx
[hydration]: https://github.com/TanStack/query/blob/ee47993724e5b71e65d9f38ae416367d2dd18395/packages/query-core/src/hydration.ts
[next-package]: https://github.com/TanStack/query/blob/ee47993724e5b71e65d9f38ae416367d2dd18395/packages/react-query-next-experimental/package.json
[changelog]: https://github.com/TanStack/query/blob/ee47993724e5b71e65d9f38ae416367d2dd18395/packages/react-query/CHANGELOG.md#51020
[promise-removal]: https://github.com/TanStack/query/commit/1ef42087c9a266c2137d2ef645cbcc662f60ac93
[historical-guide]: https://github.com/TanStack/query/blob/86bb8a6fb2c7f15c74ff50afba053d778e6edc23/docs/framework/react/guides/suspense.md#using-usequerypromise-and-reactuse-experimental
[historical-types]: https://github.com/TanStack/query/blob/86bb8a6fb2c7f15c74ff50afba053d778e6edc23/packages/query-core/src/types.ts
[historical-base]: https://github.com/TanStack/query/blob/86bb8a6fb2c7f15c74ff50afba053d778e6edc23/packages/react-query/src/useBaseQuery.ts
[react-boundary]: https://github.com/bvaughn/react-error-boundary/blob/4.1.2/src/ErrorBoundary.ts
[react-suspense]: https://react.dev/reference/react/Suspense#preventing-already-revealed-content-from-hiding
[react-use]: https://react.dev/reference/react/use
[react-store]: https://react.dev/reference/react/useSyncExternalStore#caveats
