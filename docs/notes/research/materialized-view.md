# Materialized views

Researched 2026-09-25. Covers the classical database concept, the incremental-maintenance literature that grew out of it, and how the idea is being reused by client-side sync engines. The last section maps the concept onto `@nn/store`.

Each section carries its source URLs.

---

## 1. The concept

A **view** is a named query. A **materialized view** is a named query whose result is stored, so reads hit stored rows instead of re-running the query.

PostgreSQL states the mechanism plainly: materialized views "use the rule system like views do, but persist the results in a table-like form". Reads are served from the stored copy — "when a materialized view is referenced in a query, the data is returned directly from the materialized view, like from a table; the rule is only used for populating the materialized view".

Two properties follow, and everything else in this note is a consequence of them:

1. **A materialized view is derived data.** It is fully determined by its definition plus the base relations. It can always be thrown away and rebuilt — it is a cache, not a source of truth.
2. **A materialized view can be stale.** "While access to the data stored in a materialized view is often much faster than accessing the underlying tables directly or through a view, the data is not always current; yet sometimes current data is not needed."

The trade is one of _when_ the work happens. Materialize describes it as inverting pull into push: "Instead of waiting for a query and doing computation to get the answer, we are now asking for the query upfront and doing the computation to update the results as the writes come in." Read cost drops; write cost and storage cost rise.

|                              | View      | Materialized view      | Table      |
| ---------------------------- | --------- | ---------------------- | ---------- |
| Stores rows                  | no        | yes                    | yes        |
| Recomputed on read           | yes       | no                     | n/a        |
| Derived from other relations | yes       | yes                    | no         |
| Can be stale                 | no        | yes                    | no         |
| Cost paid at                 | read time | write time (+ storage) | write time |

The classical distinction between a materialized view and an **index** is one of degree, not kind: an index is a materialized view whose definition is restricted (a projection in a particular order), which is why databases can maintain it automatically and why "indexes can be built on the columns of a materialized view".

Sources: <https://www.postgresql.org/docs/current/rules-materializedviews.html>, <https://materialize.com/guides/materialized-views/>

---

## 2. The three problems

The literature treats materialized views as three separate problems. Keeping them apart is useful when designing a system, because a given system may solve only one.

**View selection (design).** Which queries are worth materializing? Storing everything costs memory and write amplification; storing nothing gives no benefit. In a general database this is an optimization problem over a workload; in an application framework it is usually pushed onto the developer ("declare the view you want") or onto a runtime heuristic (materialize what is actually read — see Noria, §4).

**View maintenance.** Once materialized, the view "is only accurate until the underlying base relations are modified". Keeping it correct is _view maintenance_, and it is the problem with the deepest literature — §3.

**Answering queries using views (query rewriting).** Given a materialized view and an incoming query that was not written against it, can the optimizer rewrite the query to read the view instead? This is what makes materialized views transparent in Oracle/SQL Server-class systems. Client-side engines generally do **not** do this: the view is addressed directly by the application.

Sources: <https://materialize.com/guides/materialized-views/>, <https://dsf.berkeley.edu/cs286/papers/mv-fntdb2012.pdf> (Chirkova & Yang, _Materialized Views_, Foundations and Trends in Databases)

---

## 3. Maintenance

### Recomputation vs. incremental maintenance

The naive strategy is **recomputation**: discard the stored result and run the query again. PostgreSQL's built-in materialized views work this way — `REFRESH MATERIALIZED VIEW mymatview;`, typically "scheduled to update the statistics each night". Simple, always correct, cost proportional to the size of the _input_.

**Incremental view maintenance (IVM)** instead computes a delta. The PostgreSQL IVM wiki page gives the equation directly: from base-table changes `dD` the system computes view changes `dV` and applies `V' = V + dV`, so that it "computes and applies only the incremental changes to the materialized views rather than recomputing the contents as the current REFRESH command does". Cost becomes proportional to the size of the _change_.

### Immediate vs. deferred

Orthogonal to the above:

- **Immediate** — the view is updated in the same transaction that modifies the base table (PostgreSQL's IVM patch does this with `AFTER` triggers and transition tables). The view is never stale; writes pay the full cost.
- **Deferred** — the update happens later: on access, on command, or periodically. This requires a log of base-table changes, because "more than one table could be modified a lot of times before a view is updated".

Deferred-on-access is the interesting one for UI work: it is lazy recomputation, and it means writes stay cheap while a read after a write pays.

### Why it is hard

The delta rules are easy for select–project–join and get progressively nastier:

- **Duplicates** need the _counting algorithm_ — store a multiplicity per tuple; on delete "the count is decreased. If the count becomes zero, this tuple is deleted from the view".
- **Aggregates under deletion** can be non-incrementalizable: `min`/`max` may require recomputation, because "if the current min value in the view equals to the min in the old delta table, we need re-computation". `count`/`sum` are fine.
- **Outer joins** need bookkeeping for null-extended "dangling tuples".
- **Recursion, window functions, nested subqueries** are typically unsupported by hand-written delta rules.

### Self-maintainability

A view is **self-maintainable** if it can be updated from the view contents plus the modification alone, without reading the base relations. Gupta and Mumick derived conditions for this and gave algorithms for select–project–join views under insert, delete and update. The property matters wherever re-reading the base data is expensive — a data warehouse querying back to its sources, or a client holding only a partial replica.

The same body of work established the **algebraic** approach that modern systems inherit: change-propagation equations are defined per operator of the view language, so maintenance composes along the query plan and is itself expressible in the query language.

Sources: <https://wiki.postgresql.org/wiki/Incremental_View_Maintenance>, <https://www.postgresql.org/docs/current/rules-materializedviews.html>, <https://dsf.berkeley.edu/cs286/papers/mv-fntdb2012.pdf>

---

## 4. Generalisations worth knowing

**Differential dataflow** (McSherry et al.) makes incrementality a property of the execution framework rather than of hand-written rules. Collections are multisets whose changes are signed deltas (records carry positive/negative multiplicities) stamped with partially ordered timestamps; operators (`map`, `filter`, `join`, `reduce`) are defined to consume and produce such deltas, so the system "only acts where changes in collections occur, and does no work elsewhere". Iterative/recursive computations fall out of the partial order on timestamps.

**DBSP** (VLDB 2023 best paper, Budiu et al.) gives the theory a clean shape: a small stream language with — in the authors' framing — a differentiation and an integration operator, plus a mechanical transformation from any DBSP program to its incremental version. The abstract states the ambition:

> Incremental view maintenance has been for a long time a central problem in database theory. Many solutions have been proposed for restricted classes of database languages, such as the relational algebra, or Datalog. These techniques do not naturally generalize to richer languages. In this paper we give a general solution to this problem in 3 steps: (1) we describe a simple but expressive language called DBSP for describing computations over data streams; (2) we give a general algorithm for solving the incremental view maintenance problem for arbitrary DBSP programs, and (3) we show how to model many rich database query languages […] using DBSP.

The practical payoff is a SQL-to-DBSP compiler: write a normal query, get an incremental circuit. This is the current state of the art and is what "automatic IVM" means today.

**Noria** (OSDI 2018) is the closest predecessor to what client-side sync engines are doing. It targets read-heavy web applications, compiling a relational schema plus parameterized queries into a dataflow program that pre-computes read results and incrementally applies writes. Its contribution is **partially-stateful dataflow**: operators may evict state and discard writes for evicted state, so that materializing views for _every_ application query stays affordable. A read that misses issues an **upquery** backwards through the dataflow graph to reconstruct just the missing state from upstream. This is the direct answer to the view-selection problem (§2) — materialize what is hot, recompute the rest on demand — and it reports outperforming a MySQL/memcached stack by roughly 5× on the Lobsters workload.

Sources: <https://github.com/frankmcsherry/differential-dataflow>, <https://arxiv.org/abs/2203.16684>, <https://www.usenix.org/conference/osdi18/presentation/gjengset>, <https://cs.brown.edu/people/malte/pub/papers/2018-osdi-noria.pdf>

---

## 5. The concept in local-first systems

Client-side sync engines have converged on the same vocabulary, with one recurring twist: the _base relation_ is not a table but a log.

**LiveStore** is the clearest case. The eventlog is the source of truth — "all data modifications are captured as an immutable, ordered sequence of events. This eventlog serves as the canonical history" — and the local SQLite database "is a projection of this eventlog", produced by **materializers**, callbacks that map an event to SQL statements. Because the database is a materialized view of the log, it is disposable: it can be rebuilt at any time by replaying events. Schema changes to the read model become a re-materialization rather than a migration.

**ElectricSQL shapes** apply the idea to partial replication: a shape is a declaratively defined subset of a Postgres table (table + where clause + columns) that is synced to the client, where it materializes as an in-memory collection kept current by a streamed shape log. It is a materialized view whose maintenance channel happens to be the network.

**TanStack DB** goes the DBSP route in the browser: collections hold data, live queries run over them via differential dataflow (the `d2ts` library), and "when the underlying data changes in a way that would affect the query result, the result is incrementally updated" — quoted at ~0.7 ms to update one row in a sorted 100 000-item collection. Optimistic mutation state is kept separate from synced state, which is itself a view-composition question: the UI reads a view over (synced base ∪ pending local writes).

**Riffle** argued the general case for UI: put all state, including ephemeral UI state, in one reactive relational store and let the system keep registered queries fresh. It explicitly reaches for this literature — "there has been substantial work on incrementally maintaining relational queries […] which can make small updates to queries much faster than re-running from scratch" — and reports falling back to materialized views computed outside the synchronous reactive loop when latency became a problem.

The pattern across all four: **the query is the unit of subscription, and the framework's job is to keep its result materialized.** That is exactly the materialized-view problem, relocated from the server to the client, with two changed constants — the dataset is small enough that recomputation is often acceptable, and the consumer is a UI that needs a _synchronous_ read within a frame.

Sources: <https://docs.livestore.dev/overview/how-livestore-works/>, <https://electric.ax/docs/guides/shapes>, <https://tanstack.com/db/latest/docs/overview>, <https://riffle.systems/essays/prelude/>

---

## 6. Where this lands for `@nn`

`@nn/store` already implements a materialized-view cache; it is just not named as one. Mapping the vocabulary onto the current code:

| Concept              | `@nn` today                                                                        |
| -------------------- | ---------------------------------------------------------------------------------- |
| View definition      | the selector `(state) => Observable` passed to `getSnapshotOf`                     |
| Materialized result  | `Snapshot`, cached in `SnapshotManager`'s `WeakMap` keyed by the selector function |
| Base relations       | `Collection` / `LWWRegister` entities in `Store`'s state                           |
| Maintenance strategy | invalidate-and-recompute, deferred to the next read                                |
| View version         | `Snapshot.id` — `JSON.stringify(this.state)`                                       |

The flow in `packages/store/src/Store.ts:90`: a missed lookup runs the selector, wraps the result in a `Snapshot`, and subscribes to it; any `update` from the selected observable fires `invalidated`, which drops the entry from the `WeakMap` (`SnapshotManager.ts:21`) and emits `update` on the store, so React re-reads and the selector runs again from scratch.

In the taxonomy above that is: **full recomputation, deferred maintenance, no query rewriting, developer-driven view selection.** For the data sizes a local-first client holds, that is a defensible default — §3's incremental machinery buys nothing until recomputation shows up in a frame budget.

Two things do look worth recording as open questions rather than tasks:

1. **Dependency tracking is one level deep.** A `Snapshot` subscribes only to the observable the selector returned. `Collection.filter` eagerly computes a `Slice` (`packages/entities/src/Collection.ts:45`), and a write to the parent `Collection` emits on the parent, not on that `Slice` — so a snapshot taken over a filtered slice is not invalidated by writes to the base collection. In view terms, the view depends on a base relation that is not in its maintenance graph. Making derived entities either subscribe upwards or be recomputed from the base on every read would close it.
2. **`Snapshot.id` is a full serialization.** `JSON.stringify` over the whole selected state is O(view size) per call, which defeats the point of caching if it is called on every read. A monotonically increasing version counter per entity — the standard trick, and the thing an HLC already gives this project — would be O(1) and is also what a server-side snapshot identity would need to be comparable across replicas.

Neither blocks anything today. The useful framing for the thesis is that the store's snapshot layer is a materialized-view cache with a recompute-on-invalidate maintenance policy, and that the literature in §3–§4 describes precisely the upgrade path if that policy ever becomes the bottleneck.

---

## Source list

- PostgreSQL — Materialized views — <https://www.postgresql.org/docs/current/rules-materializedviews.html>
- PostgreSQL wiki — Incremental View Maintenance — <https://wiki.postgresql.org/wiki/Incremental_View_Maintenance>
- Chirkova & Yang — _Materialized Views_ (Foundations and Trends in Databases) — <https://dsf.berkeley.edu/cs286/papers/mv-fntdb2012.pdf>
- Materialize — Understanding materialized views — <https://materialize.com/guides/materialized-views/>
- Budiu et al. — _DBSP: Automatic Incremental View Maintenance for Rich Query Languages_ — <https://arxiv.org/abs/2203.16684>
- McSherry et al. — differential dataflow — <https://github.com/frankmcsherry/differential-dataflow>
- Gjengset et al. — _Noria: dynamic, partially-stateful data-flow for high-performance web applications_ — <https://www.usenix.org/conference/osdi18/presentation/gjengset>, PDF <https://cs.brown.edu/people/malte/pub/papers/2018-osdi-noria.pdf>
- LiveStore — How LiveStore works — <https://docs.livestore.dev/overview/how-livestore-works/>
- ElectricSQL — Shapes — <https://electric.ax/docs/guides/shapes>
- TanStack DB — Overview — <https://tanstack.com/db/latest/docs/overview>
- Riffle — Prelude — <https://riffle.systems/essays/prelude/>
