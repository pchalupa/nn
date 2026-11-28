# Query engines: from query text to results, and what fits a reactive in-memory layer

How does a database query engine turn a query into results? Which of those designs fit a small, in-memory, reactive query layer written in TypeScript? This note follows the classical pipeline (parse, plan, optimize, execute) through its original papers and two production engines. It then reads the code of six client-side engines that keep query results live. The last section is separate from the sourced findings and lists concrete options for `@goodstate`.

The note assumes the vocabulary of [`materialized-view.md`][nn-mv]: views vs. materialized views, recomputation vs. incremental view maintenance (IVM), immediate vs. deferred maintenance, and the overview of differential dataflow, DBSP and Noria. That material is not repeated here.

Researched **2026-11-18**. Repositories were shallow-cloned and read without running any code. Line numbers refer to the commit given. Papers were read as PDF text. Official docs were fetched on 2026-11-18.

**Papers**

- Selinger, Astrahan, Chamberlin, Lorie, Price, _Access Path Selection in a Relational Database Management System_, SIGMOD 1979 ([pdf][selinger]).
- Graefe, _Volcano: An Extensible and Parallel Query Evaluation System_, IEEE TKDE 6(1), 1994 ([pdf][volcano]).
- Boncz, Zukowski, Nes, _MonetDB/X100: Hyper-Pipelining Query Execution_, CIDR 2005 ([pdf][x100]).
- Neumann, _Efficiently Compiling Efficient Query Plans for Modern Hardware_, PVLDB 4(9), 2011 ([pdf][hyper]).
- Leis, Boncz, Kemper, Neumann, _Morsel-Driven Parallelism_, SIGMOD 2014 ([pdf][morsel]).
- Neumann, Freitag, _Umbra: A Disk-Based System with In-Memory Performance_, CIDR 2020 ([pdf][umbra]).
- Raasveldt, Mühleisen, _DuckDB: an Embeddable Analytical Database_, SIGMOD 2019 demo ([pdf][duckdb-paper]).
- McSherry, Murray, Isaacs, Isard, _Differential dataflow_, CIDR 2013 ([pdf][dd]).
- McSherry, Lattuada, Schwarzkopf, Roscoe, _Shared Arrangements_, PVLDB 13(10), 2020 ([pdf][arrangements]).

**Official documentation**

- SQLite: _Architecture_ ([page][sqlite-arch]), _The SQLite Bytecode Engine_ ([page][sqlite-opcode]), _The SQLite Query Optimizer Overview_ ([page][sqlite-opt]), _The Next-Generation Query Planner_ ([page][sqlite-ngqp]).
- PostgreSQL 18: _The Path of a Query_ ([page][pg-path]), _Planner/Optimizer_ ([page][pg-planner]), _Executor_ ([page][pg-executor]), _Statistics Used by the Planner_ ([page][pg-stats]), _Index Types_ ([page][pg-index-types]), _Index-Only Scans and Covering Indexes_ ([page][pg-ios]), _Query Planning_ configuration ([page][pg-config]).
- DuckDB 2.0: _Overview of DuckDB Internals_ ([page][duckdb-internals]), _Vectors_ ([page][duckdb-vector]).
- MDN, CSP `script-src` (last modified 2026-08-12) ([page][mdn-csp]).

**Code**

| System      | Repository @ commit                                                                     | Version                                                      |
| ----------- | --------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| DuckDB      | `duckdb/duckdb@756db2420813a1dadeded49d766313371997e194` (sparse: execution, optimizer) | `main` on 2026-11-18                                         |
| TanStack DB | `TanStack/db@21c52a07e6da3d388054224700cc69a800372f30`                                  | `@tanstack/db` 1.0.0-rc.1.5, `@tanstack/db-ivm` 1.0.0-rc.1.3 |
| Zero (ZQL)  | `rocicorp/mono@cf5515dda6c38b1dfec2c9db560ce7d0f448f80c`                                | `@rocicorp/zero` 1.13.0                                      |
| LiveStore   | `livestorejs/livestore@b9af5a0b66ec35ba5d4f49a9937859059db6ff9d`                        | `@livestore/livestore` 0.5.0                                 |
| RxDB        | `pubkey/rxdb@3afc8964f4b5890ab4bb07f1efed88ef44f120e0`                                  | 17.6.0                                                       |
| Dexie       | `dexie/Dexie.js@95666bf5370a222a21d7f53130d87b42e9b7bac7`                               | 4.4.7                                                        |
| DataScript  | `tonsky/datascript@34915cf673c02cbc64779fe56e0288d70fea63f8`                            | 1.8.1                                                        |

`@goodstate` was read from branch `nn-query` at `6f7bf0a`.

---

## Short answer

- **Every engine runs the same pipeline.** Text is parsed and bound to the schema. It becomes a tree of relational operators (the logical plan). Rewrite rules and a cost model turn that into a physical plan of concrete algorithms and access paths, and an executor runs it. System R already had four phases: "parsing, optimization, code generation, and execution" ([Selinger][selinger]). DuckDB still names the same "textbook" stages 40 years later ([DuckDB 2019][duckdb-paper]).
- **Cost-based optimization is mostly about join order and access paths, and it runs on estimates.** System R costs plans as page fetches plus weighted tuple calls. It derives selectivity from catalog statistics and falls back to a guess of 1/10. It searches join orders with dynamic programming over subsets, and keeps the cheapest plan per "interesting order". PostgreSQL, SQLite and DuckDB all refine that model, and all document that their estimates can be wrong. An in-memory client store knows its exact collection sizes, so the statistics problem largely goes away. Join ordering only matters once queries join more than two or three collections.
- **There are four execution models, and three of them were invented to cut per-tuple interpretation overhead in C/C++.** Volcano iterators pull one tuple at a time through `open`/`next`/`close`. X100 and DuckDB move vectors of about 1,000–2,048 values per call. HyPer compiles each pipeline into one tight loop and pushes tuples through it. Morsel-driven scheduling parallelises those pipelines. DuckDB moved from pull ("Vector Volcano", 2019 paper) to push ("push-based vectorized model", current docs and source). None of these gains has been measured for a JS engine in a primary source, and `new Function` code generation is blocked under a strict CSP. Both JS engines read here compile expressions to closures instead.
- **The planner treats an index as an access path with a known order and known supported operators.** A B-tree serves equality, ranges and sorted output. A hash index serves equality only. A covering index answers without touching the base rows. The planner scores each candidate and keeps the best one per useful output order. Client engines do the same thing in miniature. RxDB scores indexes with a points heuristic. Dexie makes the developer name the index. Zero and TanStack DB build sorted indexes on demand from a query's constraint and order.
- **Client-side reactive engines sit on a spectrum, from coarse "re-run on overlap" to true IVM.**
  - LiveStore re-runs SQL whenever a table it read is written.
  - Dexie re-runs when a written key range overlaps a range the query read.
  - RxDB patches a single-collection result from each change event (EventReduce) and falls back to a re-run.
  - Zero and TanStack DB push signed changes through an operator graph. TanStack DB's `db-ivm` is a fork of differential dataflow with the versions and frontiers removed. Zero's ZQL keeps little state, re-fetches upstream on demand, and outputs hierarchical rather than flat joins.
  - DataScript has no reactivity at all. Apps re-run queries from a `listen!` callback.
- **Both IVM engines share the same practical choices:**
  - multiset or add/remove/edit changes;
  - a total order on every source that includes the primary key;
  - hash or BTree state for joins;
  - a top-K window for `orderBy` + `limit`;
  - aggregates where `min`/`max` fall back to rescanning the group;
  - one flush per transaction, with unchanged rows keeping object identity.
- **For `@goodstate`** (§6, my reasoning): define the query as a small declarative IR first. Execute it by recomputation that reuses `View`'s identity-stable projections. Make the operators incremental later, filter and map first, then equi-join and top-K. Doing that needs a row-level change feed that `Store.commit` does not expose today. Adopting TanStack DB through a collection adapter is a credible alternative.

---

## 1. The pipeline

### 1.1 Parse and bind

PostgreSQL's parser "checks the query transmitted by the application program for correct syntax and creates a _query tree_". A rewrite system then applies stored rules, the planner turns the rewritten tree into a plan, and the executor "recursively steps through the _plan tree_" ([PostgreSQL, Path of a Query][pg-path]).

DuckDB splits binding from parsing explicitly. "The parser is not aware of the catalog or any other aspect of the database." The binder "converts all nodes into their bound equivalents", and the logical planner "creates LogicalOperator nodes from the bound statements" ([DuckDB internals][duckdb-internals]). The 2019 paper describes the result as "a tree of basic logical query operators such as scan, filter, project, etc.", which after planning is "a fully type-resolved logical query plan" ([DuckDB 2019][duckdb-paper]).

SQLite has the same front end, with a tokenizer and a parser. Its "code generator" then emits bytecode directly. The code generator, "and especially the logic in where\*.c and in select.c, is sometimes called the query planner" ([SQLite architecture][sqlite-arch]).

A client library that takes queries as builder calls instead of text skips parsing and keeps binding. TanStack DB's `BaseQueryBuilder` produces a `QueryIR` with `from`, `join`, `where[]`, `groupBy`, `having[]`, `orderBy`, `limit`, `offset`, `distinct` and `select`. Its expression nodes are `PropRef`, `Value`, `Func` and `Aggregate` ([`query/ir.ts`][td-ir] L16, L91–L313). It also carries opaque escape hatches (`fnWhere`, `fnSelect`, `fnHaving`, L31–L34) that the optimizer cannot see into. Zero's ZQL builder produces an AST that the server and client share ([`builder.ts` `buildPipeline`][z-builder] L229).

### 1.2 Logical plan and rule-based rewrites

The logical plan is relational algebra. Rewrites are algebraic identities applied without consulting costs. DuckDB's list:

- an expression rewriter that "simplifies expressions, performs constant folding";
- filter pushdown;
- common subexpression elimination;
- an IN-clause rewriter;
- the join order optimizer ([DuckDB internals][duckdb-internals]).

The current `src/optimizer/` holds roughly 70 such passes ([DuckDB source][duckdb-optimizer]). DuckDB also flattens "arbitrary subqueries" ([DuckDB 2019][duckdb-paper]).

SQLite documents the same family ([SQLite optimizer overview][sqlite-opt]):

- **Subquery flattening.** "SQLite attempts to flatten subqueries in the FROM clause of a SELECT."
- **Predicate push-down**, with stated limits. "If the subquery contains a LIMIT, then pushing down any part of the WHERE clause from the outer query could change the result of the inner query."
- **OR rewrites.** OR over one column becomes `IN`, and an OR whose terms are each indexable can be "coded such that a separate index is used to evaluate each term".

TanStack DB's optimizer is pure predicate pushdown. It "rewrites the intermediate representation (IR) to push WHERE clauses as close to the data source as possible" ([`optimizer.ts`][td-optimizer] L1–L6).

- It splits the top-level AND and groups the clauses by the sources they touch. Single-source clauses are wrapped into subqueries around their source. It iterates to a fixpoint, with at most 10 passes (L204, L226).
- It refuses to push into a subquery that has DISTINCT, aggregates, GROUP BY/HAVING, or ORDER BY with LIMIT/OFFSET (`isSafeToPushIntoExistingSubquery`, L1083–L1104). This is the same rule SQLite documents.
- For outer joins, it copies a clause down and also keeps it as a residual filter (L47–L51).
- It returns the per-source filters "for index optimization" (L167–L172). The live layer uses them to read the initial snapshot through an index.

### 1.3 Cost-based optimization

System R is the template. The optimizer "chooses both join order and an access path for each table" ([Selinger][selinger]).

- **Cost formula.** "COST = PAGE FETCHES + W \* (RSI CALLS)", where W weights CPU against I/O.
- **Statistics** come from the catalog: NCARD (tuples), TCARD (pages), ICARD (distinct keys in an index). They are refreshed by an explicit command, not on every write, "because of the extra database operations and the locking bottleneck this would create".
- **Selectivity.** Each predicate gets a selectivity factor F, for example "F = 1 / ICARD(column index) if there is an index on column" and "F = 1/10 otherwise".
- **Interesting orders.** "A tuple order is an interesting order if that order is one specified by the query block's GROUP BY or ORDER BY clauses", and every equi-join column defines one too. For each subset of relations and each interesting order, the optimizer keeps "the cheapest solution for achieving that order".
- **Search.** "Once the first k relations are joined, the method to join the composite to the k+1st relation is independent of the order of joining the first k." This is dynamic programming over growing subsets. A heuristic defers Cartesian products "as late in the join sequence as possible".
- **Join methods:** nested loops and merging scans.

Modern engines refine each piece:

- **PostgreSQL** always creates a sequential-scan path, plus one path per index whose operator class matches a predicate. It considers nested-loop, merge and hash joins ([Planner/Optimizer][pg-planner]).
  - It searches exhaustively up to `geqo_threshold` FROM items (default 12), then switches to a genetic optimizer. Below that, `from_collapse_limit` and `join_collapse_limit` (default 8) bound reordering ([config][pg-config]).
  - Statistics are `reltuples`/`relpages` plus `pg_statistic` (most-common values, histograms), "always approximate even when freshly updated". Optional extended statistics cover multi-column dependencies, n-distinct and MCVs ([statistics][pg-stats]).
- **SQLite** "implements joins as nested loops" ([optimizer overview][sqlite-opt]).
  - Its planner chooses only the nesting order and the index per loop. It finds that order with "N Nearest Neighbors", a bounded best-first graph search ([NGQP][sqlite-ngqp]).
  - It "makes guesses for the cost of running a loop based on the availability of indexes and constraints", and `ANALYZE` (`sqlite_stat1`) improves those guesses. The page states the general limit plainly: "The query planner must work with incomplete information."
- **DuckDB** performs "join order optimization using dynamic programming with a greedy fallback for complex join graphs". It estimates cardinality with "a combination of samples and HyperLogLog" ([DuckDB 2019][duckdb-paper]). The current enumerator is "a straight implementation of" Moerkotte and Neumann's _Dynamic Programming Strikes Back_, and it switches to approximate solving above a configurable relation count ([`plan_enumerator.cpp`][duckdb-enum] L628–L638).

Client engines do far less:

- **Zero's planner** is cost-based, but it searches only one dimension: whether each `EXISTS` join is driven from the parent ("semi") or from the child ("flipped").
  - It enumerates "all possible flip patterns for flippable joins (2^n for n flippable joins)" and picks the cheapest ([`planner-graph.ts`][z-planner-graph] L261–L274). It gives up above `MAX_FLIPPABLE_JOINS = 9` (L32).
  - Costs come from SQLite's own planner via `sqlite3_stmt_scanstatus_v2`, plus fanout from `sqlite_stat4`/`stat1` ([`sqlite-cost-model.ts`][z-cost] L32–L108, [`sqlite-stat-fanout.ts`][z-fanout] L40–L91). It states the classic weakness: "We do not know if the probabilities are correlated so we assume independence. This is a fundamental limitation of the planner" ([`planner-join.ts`][z-planner-join] L348–L349).
  - It runs only on the server. The client calls `buildPipeline` without a cost model ([`query-delegate-base.ts`][z-qdb] L510).
- **TanStack DB** has no cost model, statistics or join reordering. Its one cardinality rule is in the join compiler: "The smallest collection should be the active collection and the biggest collection should be lazy", decided by `leftCollection.size < rightCollection.size` ([`compiler/joins.ts`][td-joins] L782–L786). An in-memory engine knows those sizes exactly.

### 1.4 Physical plan

The physical planner binds each logical operator to an algorithm and an access path. DuckDB's "scan may decide to use an existing index instead of scanning the base tables based on selectivity estimates, or switch between a hash join or merge join depending on the join predicates" ([DuckDB 2019][duckdb-paper]). In PostgreSQL, "after the cheapest path is determined, a full-fledged plan tree is built to pass to the executor" ([Planner/Optimizer][pg-planner]). In SQLite the physical plan _is_ the bytecode program (§2.4). Volcano adds one idea that matters for long-lived plans: a **choose-plan** meta-operator that delays "selected optimization decisions until run-time, e.g., for embedded queries with free variables" ([Volcano][volcano]). A parameterized live query is the same situation.

---

## 2. Execution models

### 2.1 Volcano: pull one tuple at a time

"In Volcano, all algebra operators are implemented as iterators, i.e., they support a simple open-next-close protocol" ([Volcano][volcano]).

- Calling `open` on the top operator opens the whole tree recursively. "next for the top-most operator is called repeatedly until it fails with an end-of-stream indicator". `close` shuts everything down.
- Each operator keeps its state in a state record and does not know what produces its input ("anonymous inputs or streams").
- Graefe argues that this is "the most efficient execution model in terms of time … and space … for single-process query evaluation". The exchange operator translates "between demand-driven dataflow within processes and data-driven dataflow between processes".

PostgreSQL's executor is this model. It "is essentially a demand-pull pipeline mechanism. Each time a plan node is called, it must deliver one more row, or report that it is done delivering rows" ([Executor][pg-executor]). System R's scans already used "OPEN, NEXT, and CLOSE" ([Selinger][selinger]).

### 2.2 Vectorized: pull a vector at a time

Boncz et al. found that "the common way to implement the popular Volcano iterator model … leads to tuple-at-a-time execution, which causes both high interpretation overhead, and hides opportunities for CPU parallelism from the compiler" ([X100][x100]).

- MySQL spent 49 cycles per addition in their TPC-H Q1 trace, because each call "only performs one addition, preventing the compiler from creating a pipelined loop".
- MonetDB's column-at-a-time model avoided that overhead but paid for "full column materialization", which made it memory-bandwidth bound.
- X100 keeps Volcano's pipelining but makes the unit "small (e.g. 1000 values) vertical chunks of cache-resident data items, called 'vectors'". A `Select` produces a **selection vector** of matching positions, so later primitives skip rows without copying them.

DuckDB adopted this: "DuckDB uses a vectorized interpreted execution engine. This approach was chosen over Just-in-Time compilation (JIT) of SQL queries for portability reasons" ([DuckDB 2019][duckdb-paper]). Its current docs give "the default STANDARD_VECTOR_SIZE is 2048 tuples". Vectors may be flat, constant, dictionary or sequence encoded ([Vectors][duckdb-vector]).

### 2.3 Push-based pipelines and morsel-driven scheduling

Neumann's HyPer paper inverts the direction. "Data is not pulled by operators but pushed towards the operators. This results in much better code and data locality" ([HyPer][hyper]).

- A **pipeline breaker** is an operator that "takes an incoming tuple out of the CPU registers". A full pipeline breaker "materializes all incoming tuples", as a hash-join build or a sort does.
- Between breakers, a whole chain of operators becomes one loop. Each operator only exists at compile time, as a `produce()`/`consume()` pair that emits code.

Morsel-driven parallelism schedules those pipelines. Worker threads take "small fragments of input data ('morsels')" (e.g. 100,000 tuples) and "run entire operator pipelines until the next pipeline breaker". Parallelism is "not baked into the plan but can elastically change during query execution" ([Morsel-driven][morsel]). The paper also notes that tuple-at-a-time Volcano "has been shown to introduce significant interpretation overhead". Systems have been "moving … towards vector or batch-oriented execution".

DuckDB combined vectors with push.

- The 2019 paper describes a "Vector Volcano" model in which execution "commences by pulling the first 'chunk' of data from the root node" ([DuckDB 2019][duckdb-paper]).
- The current docs say "DuckDB uses a push-based vectorized model, where DataChunks are pushed through the operator tree" ([DuckDB internals][duckdb-internals]).
- The source shows the shape. `PhysicalOperator` has separate Source (`GetData`), Operator (`Execute`) and Sink (`Sink`/`Combine`/`Finalize`) interfaces ([`physical_operator.hpp`][duckdb-op] L106–L228). `PipelineExecutor::ExecutePushInternal` "will continuously push the input chunk through the pipeline" until the sink blocks or the budget runs out ([`pipeline_executor.cpp`][duckdb-pipe] L560–L575).

### 2.4 Query compilation and bytecode

Compilation is older than it looks. System R's code generator was "a table-driven program which translates ASL trees into machine language code", with "one [code template] for each type of join method" ([Selinger][selinger]).

- **HyPer** generates LLVM IR, and the result "frequently rivals the performance of hand-written C++ code" ([HyPer][hyper]).
- **Umbra** keeps compilation but makes it adaptive, because LLVM's latency hurts short queries. "Initially, the IR associated with a step is always translated into an efficient bytecode format and interpreted by a virtual machine backend". It compiles to machine code only when progress tracking says it pays off ([Umbra][umbra]).
- **SQLite** goes straight to bytecode. "SQLite works by compiling SQL text into bytecode, then running that bytecode using a virtual machine" ([architecture][sqlite-arch]).
  - A prepared statement "is mostly just the bytecode needed to implement the corresponding SQL". The program has a fixed register file, and it touches data only through cursors ([bytecode engine][sqlite-opcode]).
  - The program is a linear instruction list with jumps (`Rewind` … `Column` … `ResultRow` … `Next`), not an operator tree. `sqlite3_step()` runs it until it produces a row.
  - In effect, SQLite compiles the nested loops of §1.3 into a flat program and pauses it at each output row. That is pull at the API boundary and straight-line code inside.

JS engines have a constraint here. Under a CSP that sets `script-src` without `'unsafe-eval'`, `eval()` and `Function()` "are blocked and won't have any effect" ([MDN][mdn-csp]). The two JS IVM engines compile instead by building closures from the expression tree:

- TanStack DB: `compileExpression` "eliminates branching during evaluation by pre-compiling the expression structure" ([`evaluators.ts`][td-eval] L99–L109).
- Zero: `createPredicate` returns nested `(row) => boolean` closures ([`filter.ts`][z-filter] L50).

Neither uses `new Function` in its query path (grep over `packages/db/src` and `packages/zql/src`).

### 2.5 What carries over to a small JS engine

The papers in §2.1–§2.4 measure C/C++ engines on analytical workloads over millions of rows. The client engines read here use the following:

| Engine      | Initial result (hydration)                                                                                                          | Changes                                                                  | Batch unit                                            |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ | ----------------------------------------------------- |
| Zero        | Pull: `Input.fetch` returns a lazy `Iterable` "sorted in order of `SourceSchema.compareRows`" ([`operator.ts`][z-operator] L27–L47) | Push: `Output.push(change)`, then a `reconcile()` phase (L143–L180)      | One row change. `'yield'` tokens time-slice hydration |
| TanStack DB | Push: the snapshot is sent into the graph as inserts                                                                                | Push: `DifferenceStreamWriter.sendData` ([`graph.ts`][td-graph] L36–L45) | A `MultiSet` of `[row, ±n]` per message               |
| SQLite      | Pull at `sqlite3_step()`, nested loops inside                                                                                       | none                                                                     | one row                                               |

The trade-offs below are my reasoning, not measured.

- **Pull suits hydration and `limit`.** Zero's `Take` stops pulling after _n_ rows, and the source scan stops with it.
- **Push suits changes.** A change starts at a source and has to reach every dependent query, which is the data-driven direction Volcano's exchange operator already names.
- Both JS engines are hybrids in this sense. TanStack DB pushes everything, including the snapshot, and handles `limit` with a top-K operator plus index-driven lazy loading (§4.3).
- **Vectorization's benefit is unknown in JS.** Its benefit comes from tight loops that a C compiler can pipeline and SIMD-ize. Whether a JS JIT gets a comparable gain from array-at-a-time operators over per-row closures is not established by any source read here.
- **What does carry over:** batch a transaction's changes into one message, and flush the output once, after the graph is quiescent (§4.3, §4.4).

---

## 3. Indexes and access paths, as the planner sees them

To a planner, an index is an access path with three properties: which predicates it can satisfy, what order it returns rows in, and whether the base row must still be fetched.

- **B-tree.** It handles "equality and range queries on data that can be sorted into some ordering", and "can also be used to retrieve data in sorted order" ([PostgreSQL index types][pg-index-types]).
  - For a multi-column B-tree, SQLite's rule is: "The initial columns of the index must be used with the = or IN or IS operators. The right-most column that is used can employ inequalities", with no gaps ([SQLite optimizer overview][sqlite-opt]).
  - Sorted output is what makes an index an "interesting order" in System R's sense. It can remove a sort or enable a merge join.
- **Hash.** Hash indexes "can only handle simple equality comparisons" ([PostgreSQL index types][pg-index-types]). They produce no useful order.
- **Covering.** "When an index contains all of the data needed for a query and when the original table never needs to be consulted, we call that index a 'covering index'" ([SQLite][sqlite-opt]). PostgreSQL builds them with `INCLUDE` and serves them as index-only scans, subject to its visibility map ([PostgreSQL][pg-ios]).
- **Transient.** "When no indexes are available to aid the evaluation of a query, SQLite might create an automatic index that lasts only for the duration of a single SQL statement" ([SQLite][sqlite-opt]). A hash-join build table is the same thing under another name.
- **Selection.**
  - System R costs every index plus a segment scan. It keeps the cheapest path per interesting order and the cheapest unordered path ([Selinger][selinger]).
  - PostgreSQL always generates a sequential-scan path, plus one path per index whose operator class matches a predicate ([Planner/Optimizer][pg-planner]).
  - SQLite's `ANALYZE` lets the planner learn that, for example, "an equality constraint on column x reduces the search space to 10 rows on average, whereas an equality constraint on column y reduces the search space to 3 rows" ([SQLite][sqlite-opt]).

Client engines apply the same ideas with simpler machinery.

**RxDB** has a Mango query planner, `getQueryPlan` in [`query-planner.ts`][rx-planner] L37.

- Schema normalisation prefixes every index with `_deleted` and appends the primary key.
- For each candidate index, each field's matcher becomes a start and end key. `$in` becomes a min..max range that is filtered afterwards.
- `rateQueryPlan` (L526) scores 10 points per bounded leading start key and 10 per bounded end key, plus `equalKeyCount*10*1.5`, plus 5 when no re-sort is needed. Ties go to the later index (L276).
- Descending sorts always re-sort: "having a 'desc' in the sorting, means we always have to re-sort the results" (L47–L51).
- When `isSelectorSatisfiedByIndex` holds (L320), storage skips the per-document matcher. That is the client equivalent of an index fully answering a predicate.
- The memory storage keeps each index as a sorted array of `[indexString, doc, id]` and binary-searches the bounds ([`rx-storage-instance-memory.ts`][rx-mem] L285–L412).

**Dexie** has no planner. "`Table.where(string)` uses that index directly" ([`table.ts`][dx-table] L148–L152).

- For an object `where({a, b})`, it picks the shortest compound index whose leading key paths are exactly the given keys (L157–L185).
- Otherwise it uses the first indexed key and filters the rest in JS (L200–L230), and warns in debug mode that the query "would benefit from a compound index".

**Zero's `MemorySource`** keeps every index as a `BTreeSet<Row>` and builds indexes on demand ([`memory-source.ts`][z-mem]).

- The index sort for a fetch is the constraint columns followed by the connection's requested order. `#getOrCreateIndex` builds a missing index synchronously from the primary index (L240–L290).
- Indexes are never dropped: "keeping all indexes for the lifetime of the page seems better" (L225–L231).
- Every connection's order must include the primary key: "Source must return rows in this order. Must include all primary keys of the table" ([`source.ts`][z-source] L62–L63). `completeOrdering` appends the key automatically ([`builder.ts`][z-builder] L258). Comparisons are therefore total, and `start` bounds and binary search are well defined.

**TanStack DB** has two index types.

- `BasicIndex` is a "Map for O(1) equality lookups; Sorted Array for O(log n) range queries … O(n) updates" ([`basic-index.ts`][td-basic-index] L28–L37). `BTreeIndex` is a vendored B+ tree.
- `optimizeExpressionWithIndexes` intersects index results for AND. It unions them for OR only if every disjunct is indexable, and otherwise falls back to a full scan with a filter ([`index-optimization.ts`][td-index-opt] L215, L630–L750).
- `autoIndex` defaults to `off`. When set to `eager`, it creates `auto:<path>` indexes for simple WHERE fields and lazy-join keys when a subscription starts ([`auto-index.ts`][td-auto-index] L91–L105).

**DataScript** keeps three covering sorted sets of datoms: EAVT, AEVT and AVET ([`db.cljc`][ds-db] L678). The AVET set holds only indexed, unique or ref attributes.

- `-search` dispatches on which of `[e a v tx]` are bound (L720–L760).
  - Bound `e` scans EAVT.
  - Bound `a`+`v` scans AVET if the attribute is indexed, else AEVT plus a filter.
  - Bound `v` alone falls back to a full EAVT scan.
- This is access-path selection by pattern shape, with no cost model.

---

## 4. Reactive and incremental queries

[`materialized-view.md`][nn-mv] §3–§5 covers why IVM is hard (duplicates, `min`/`max` under deletion, outer joins), the DBSP and Noria lines of work, and how LiveStore, Electric, TanStack DB and Riffle frame "the query is the unit of subscription". This section covers the engine mechanics.

### 4.1 Differential dataflow: what the client engines borrow and what they drop

McSherry et al. model collections as multisets, "where for a collection A and record x the integer A(x) indicates the multiplicity of x in A". Changes are difference traces, δA_t = A_t − A_{t−1}, where "δA_t(r) may be negative, corresponding to the removal of a record r" ([Differential dataflow][dd]). The paper adds two things on top of ordinary incremental computation:

1. "the state of the computation varies according to a partially ordered set of versions rather than a totally ordered sequence of versions";
2. "the set of updates required to reconstruct the state at any given version is retained in an indexed data-structure, whereas incremental systems typically consolidate each update in sequence into the 'current' version of the state and then discard the update".

Both exist to support iteration nested inside incremental updates.

_Shared Arrangements_ addresses the memory cost of that indexed state. Without sharing, "each query must independently maintain the same indexed state over the same input streams, and new queries must build this state from scratch". Arrangements are "indexed views of maintained state that allow concurrent queries to reuse the same in-memory state" ([Shared Arrangements][arrangements]). They are a database index for dataflow, attached post hoc in the same way.

A UI query layer has no nested iteration. It has one totally ordered stream of local transactions, so the partial order adds nothing. TanStack DB's `db-ivm` draws exactly that conclusion. It is "forked from @electric-sql/d2ts, but simplified and without the complexities of multi-dimensional versioning … without the need to specify a version when sending data, or to send a frontier" ([`db-ivm/README.md`][td-ivm-readme] L1–L7). What it keeps are signed multiplicities and indexed operator state.

### 4.2 Change representations

| Engine      | Change unit                                                                                                                                                | Update encoding                                                                               |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| TanStack DB | `MultiSet<T>` = `Array<[T, multiplicity]>` ([`multiset.ts`][td-multiset] L4–L16)                                                                           | −old/+new ([`live/utils.ts`][td-live-utils] L123–L146)                                        |
| Zero        | `add` / `remove` / `edit` / `child` ([`change.ts`][z-change] L12–L57). `child` means "the node's row is unchanged, but one of its descendants has changed" | `edit`, split into remove+add when a join key changes ([`memory-source.ts`][z-mem] L764–L818) |
| RxDB        | the collection's change event (insert/update/delete of one document)                                                                                       | event carries previous and new document                                                       |
| Dexie       | an observability set: per index, a `RangeSet` of keys or ranges written ([`observability-middleware.ts`][dx-obs] L61–L175)                                 | old and new index keys per changed index                                                      |
| LiveStore   | table name                                                                                                                                                 | none at row level                                                                             |

### 4.3 TanStack DB: a version-free differential dataflow graph

Pipeline:

- The builder produces IR, the optimizer applies predicate pushdown (§1.2), and the compiler emits one D2 graph per live query ([`compiler/index.ts`][td-compiler] L403).
- The compiler emits operators in SQL clause order: FROM, JOIN, WHERE, SELECT, GROUP BY, HAVING, DISTINCT, then ORDER BY / top-K (L503–L1330).
- `limit`/`offset` without `orderBy` throws (L1287–L1292). Join conditions must be `eq` or an AND of `eq`s ([`join-conditions.ts`][td-join-conditions] L5–L17).

Scheduling:

- `D2.run()` loops over the operators in registration order, running every one that has pending input, "until a complete pass runs none" ([`d2.ts`][td-d2] L58–L75).
- A run is synchronous. A transaction coalesces the runs so that "each builder runs at most once per transaction" ([`collection-config-builder.ts`][td-ccb] L925–L931).
- Output is accumulated per key and flushed once: "Publish only after every operator has reached quiescence … flushing between those steps would expose a mixed root snapshot" (L892–L894).

Operators:

- **Join** keeps both inputs fully indexed and applies the textbook delta rule, "ΔA⋈B_old + A_old⋈ΔB + ΔA⋈ΔB". Outer joins also track presence transitions "0→>0 (retract nulls) or >0→0 (emit nulls)" ([`join.ts`][td-join] L9–L23).
- **Reduce/groupBy** collects the changed keys. For each one it re-runs the reducer over the whole group and diffs the result against the stored output ([`reduce.ts`][td-reduce] L41–L60). That makes `min`/`max`/`median`/`mode` O(group size) per change, the non-incrementalizable case from `materialized-view.md` §3.
- **orderBy + limit** uses `topKWithFractionalIndex`. A sorted array holds all rows with an `[offset, offset+limit)` window, and "inserts and deletes are O(n) operations" ([`topKArray.ts`][td-topk] L57–L62). Each emitted row carries a fractional-index string, so only moved rows get new sort keys, and the window can move (pagination) without recompiling.

Access paths into the graph:

- The per-source pushed-down `where` reads the initial snapshot through an index (§3).
- Joins are lazy. The smaller side is "active", and a `tap` on it computes demanded join keys, which the lazy side loads by index or by `loadSubset` from the sync layer ([`compiler/joins.ts`][td-joins] L415–L447, L758–L790).
- For `orderBy` + `limit`, an index on the first sort column feeds the top-K from the source, because "values bigger than what we've sent don't need to be sent" ([`collection-subscriber.ts`][td-subscriber] L364).

Vendor claim: "Updating one row in a sorted 100,000-item collection completes in ~0.7ms on an M1 Pro MacBook" ([`docs/overview.md`][td-overview] L157–L159). That page still says d2ts, while the code uses the forked `db-ivm`.

### 4.4 Zero ZQL: pull for hydration, push for changes, hierarchical output

ZQL operators implement both directions.

- `fetch(req)` returns a lazy sorted stream. `req` can carry an equality `constraint`, a `start` bound, `reverse`, or a pushed-down `filter` that "Sources may use … to drive index selection" ([`operator.ts`][z-operator] L66–L137).
- `push(change)` propagates a change, and a second phase, `reconcile()`, lets "Bounded operators (such as Take or Cap) … refill deficits" (L143–L180).

Joins are hierarchical. "Zero's join is a little different from SQL's join in that we output hierarchical data, not a flat table. This makes it a lot more useful for UI programming and avoids duplicating tons of data like left join would" ([`join.ts`][z-join] L66–L75).

- A join stores no child rows. Each parent's relationship is a closure that re-fetches the child input, using the join key as the constraint (L411–L473).
- A child change fetches the matching parents and emits a `child` change on each (L303–L375).
- This keeps little state and leans on the source's indexes, the opposite trade from TanStack DB's two full join indexes. That it resembles Noria's partial state more than differential dataflow is my reading. The code cites neither.

Limits are the stateful part:

- `Take` keeps `{size, bound}` per partition. An add below the bound evicts the bound row, and a remove is refilled in `reconcile` with a reverse fetch from the bound ([`take.ts`][z-take] L57–L67, L309–L420).
- Aggregates support `count|sum|avg|min|max`. Invertible ones update in O(1). Removing a `min`/`max` extreme re-fetches ([`aggregate.ts`][z-aggregate] L426–L451).

The view applies changes immutably with copy-on-write. "Unchanged entries keep identity, enabling shallow comparison optimizations in UI frameworks" ([`view-apply-change.ts`][z-view-apply] L155–L160). Views notify on transaction commit, not on each push ([`view.ts`][z-view] L15–L29).

Partial replication has a semantic cost that full replicas do not pay: the client disallows `NOT EXISTS` because "we can't distinguish between a row not existing vs. a row not being synced to the client" ([`builder.ts`][z-builder] L90–L100).

### 4.5 LiveStore: re-run on table invalidation

LiveStore runs SQLite in the client and wraps queries in a small signals graph ([`reactive.ts`][ls-reactive] L1–L22).

- Each table has a `Ref` that always compares unequal ([`store.ts`][ls-store] L336–L383). The tables a query reads come from SQLite's `tables_used()` function ([`SqliteDbWrapper.ts`][ls-wrapper] L64), and a `queryDb` thunk subscribes to each ([`db-query.ts`][ls-db-query] L378–L392).
- A commit sets all written-table refs in one batch, and every dependent query re-executes its full SQL.
- A table-scoped result cache exists. Its comments list finer invalidation and incremental view updates as future steps ([`QueryCache.ts`][ls-cache] L61–L69).
- The store's own comment: "TODO generalize the `tableRefs` concept to allow finer-grained refs" ([`store.ts`][ls-store] L338).

The header of `reactive.ts` promises topological-order refresh and "at every thunk we check value equality with the previous value and cutoff propagation if possible" (L19–L22). In the code at this commit:

- `markSuperCompDirtyRec` marks every downstream thunk dirty before anything recomputes (L606–L609).
- The equality result is recorded only in debug info (L288–L303).
- The React hook deduplicates with `deepEqual` instead ([`useQuery.ts`][ls-usequery] L123).

That is my reading of this one file (§7).

### 4.6 RxDB: EventReduce over single-collection queries

"When a document is written, RxDB calculates the new results of a query from the old results and the change event, instead of running the query against the storage again" ([`event-reduce.md`][rx-er-doc] L9).

- `calculateNewResults` asks `event-reduce-js` for an action per event. The answer is `runFullQueryAgain`, `doNothing`, or an in-place edit of the previous results ([`event-reduce.ts`][rx-er] L138).
- For `skip`/`limit` queries, RxDB keeps a buffer of rows just outside the window, so that rows moving into the window are "taken from the buffer instead of running the query again" (L219–L307).
- `RxQuery` falls back to a full re-execution when:
  - the query has not run yet;
  - the 100-event change buffer no longer covers the gap;
  - an event came from another instance;
  - the action is `runFullQueryAgain` ([`rx-query.ts`][rx-query] L807–L901).

RxDB queries are single-collection Mango selectors, so there is no join to maintain.

### 4.7 Dexie: range-overlap invalidation, with optimistic patching of cached results

`liveQuery` records what a querier read as an "observability set": per index, a `RangeSet`, which is "an interval tree implementation to efficiently detect overlapping ranges of queried indexes" ([`rangeset.ts`][dx-rangeset] L12–L14).

- Writes record the primary keys and the old and new index keys they touched. With 50 or more values they record the full range instead: "Too many requests to record the details without slowing down write performance" ([`observability-middleware.ts`][dx-obs] L129–L137).
- If the two sets overlap, the whole querier re-runs ([`live-query.ts`][dx-live] L88–L99).
- A cache middleware patches cached query results with optimistic writes ([`apply-optimistic-ops.ts`][dx-optimistic] L12), so the re-run is often served without touching IndexedDB.

This is the read-set/write-set conflict test of optimistic concurrency control, applied to invalidation. It is precise per key range and needs no query algebra.

### 4.8 DataScript: in-order Datalog with hash joins, no reactivity

DataScript is the contrast case. It evaluates a query as `(reduce resolve-clause context clauses)`, strictly in the order written ([`query.cljc`][ds-query] L857–L859).

- Each pattern becomes an index scan (§3).
- A new relation is `hash-join`ed with every existing relation that shares a variable (L346, L469). Disjoint relations stay separate until a final cross product.
- `not` is a hash anti-join (L379).

There is no planner. The user's clause order is the join order, and predicates must come after the clauses that bind their variables. Reactivity is `listen!`, a callback with the transaction report (`:db-before`, `:db-after`, `:tx-data`), and apps re-run queries themselves ([`conn.cljc`][ds-conn] L159). DataScript shows how far a clean relational core gets with no optimizer at all. It also shows the cost: the developer does the planning.

### 4.9 Side by side

| Engine      | Invalidation granularity | Maintenance                      | Join state                                      | Top-K                              | Planner                              |
| ----------- | ------------------------ | -------------------------------- | ----------------------------------------------- | ---------------------------------- | ------------------------------------ |
| LiveStore   | table                    | re-run SQL                       | SQLite                                          | SQLite                             | SQLite's                             |
| Dexie       | index key range          | re-run querier, patched cache    | none (single table per request)                 | re-sort and trim in cache patch    | none (developer names the index)     |
| RxDB        | collection event         | EventReduce, else re-run         | none (single collection)                        | window plus buffer                 | index scoring heuristic              |
| Zero        | row change               | IVM, push plus refetch           | none stored. Refetch by key, `JoinIndex` filter | `Take` bound plus refill           | server: flip-only, SQLite cost model |
| TanStack DB | row change               | IVM, differential (version-free) | both sides fully indexed                        | sorted array plus fractional index | rule-based pushdown, size heuristic  |
| DataScript  | none                     | none                             | per-query hash join                             | n/a                                | none (clause order)                  |

---

## 5. Cross-cutting findings

1. **Recomputation is the default, and IVM is an optimization added later.** LiveStore, Dexie and DataScript re-run queries. RxDB re-runs whenever EventReduce cannot decide. Even TanStack DB and Zero recompute aggregate groups, or refetch, for `min`/`max` removals. Coarse invalidation plus re-run is what most shipped client engines do.
2. **A total order with a key tie-breaker is a precondition for incremental `orderBy`/`limit`.** Zero enforces it in every source connection. TanStack DB requires `orderBy` for `limit`. Without a total order, "the row before the bound" and "the window" are undefined.
3. **Exact sizes replace statistics.** Every server planner documents its estimates as approximate. The client engines that use any cardinality at all (TanStack DB's join side choice) read exact `.size` values. Zero's server planner relies on SQLite's statistics for the data it does not hold.
4. **Indexes are built on demand and kept.** Zero builds them on first use and never drops them. TanStack DB auto-indexes when opted in. SQLite builds automatic indexes per statement. None of the client engines asks the user to declare indexes for correctness. Dexie and RxDB do for speed.
5. **The output contract is "changes, flushed once per transaction, with stable identity for unchanged rows".** Zero's `applyChange` and TanStack DB's one-transaction flush both deliver it, and it is what React's `useSyncExternalStore` plus memoized children need.
6. **Hierarchical results match UI trees.** Zero's relationship streams and TanStack DB's `IncludesSubquery` both avoid flattening one-to-many joins into duplicated rows.
7. **Expressions are compiled to closures, not code strings.** This is consistent with the CSP restriction on `Function()`.

---

## 6. What this means for `@goodstate`

_This section is my analysis. It uses the findings above and the current code, but it is not a sourced finding._

### 6.1 What the store offers a query layer today

- **Identity-stable, frozen projections.**
  - `Store.read()` returns `View.read(root)` ([`store.ts`][nn-store] L34–L37). `View` caches each entity's frozen projection by `(entity, entity.revision)` in a `VersionedCache` ([`view.ts`][nn-view] L36, L45; [`versioned-cache.ts`][nn-versioned-cache]).
  - `Entity.revision` increments on every `didChange`, and containers re-emit when a child changes ([`entity.ts`][nn-entity] L47–L50, [`rga.ts`][nn-rga] L45, [`lww-map.ts`][nn-lww-map] L20).
  - So after a write, an unchanged row returns the _same object_ it did before. That is the identity guarantee §5.5 calls the output contract, and Zero and TanStack DB both work to provide it. `@goodstate` already has it on the input side.
- **Change notifications are coarse.**
  - `Store.commit` installs a delegate on the root and records only the root's direct children, the top-level fields ([`store.ts`][nn-store] L77–L104). `onChange` then delivers those fields encoded.
  - Below the root, the delegate chain does carry `child` at every level: `RGA.entityDidChange(child)` knows which row changed. `Store` discards that.
  - [ADR-08][adr08] removed per-row change descriptions from `RGA` because nothing read them. It said "a consumer that needs to know what changed reads `current` and compares it" and "we can derive a description again if something asks for one". An incremental query layer is that consumer.
- **No total order yet.**
  - `RGA` order is local insertion order. The ordering CRDT is deferred ([ADR-11][adr11], [ADR-19][adr19]). Removals are permanent tombstones (ADR-19).
  - Sync engines merge whole encoded roots ([ADR-19][adr19]), so one merge can touch many rows at once.
- **React reads the whole state.** `useRead` passes `store.read()` through `useSyncExternalStoreWithSelector` with an `equal` check ([`react/src/index.ts`][nn-react] L33). Each selector re-runs on every store change and is deduplicated by equality, the "re-run and compare" end of §4.9.

### 6.2 Options

**A. Memoized selectors over projections, with no engine.** Queries stay plain functions over `read()`. A small helper library supplies `filter`, `sort`, `join` and `groupBy` functions that memoize on input identity:

- skip the work when the input array is `===` the previous one;
- cache per-row predicate results in a `WeakMap` keyed by the row projection, so a changed collection costs O(n) identity checks plus O(changed) predicate calls;
- build join hash maps per input identity.

| Pros                                                                                             | Cons                                                                                                                         |
| ------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| No new store API. Uses the identity guarantee already in `View`. Works with `useRead` unchanged. | O(n) per changed collection per query. No index use. No query description to optimize, inspect, persist or send to a server. |

**B. A declarative query IR, executed by recomputation.** Define a small IR modeled on TanStack DB's `QueryIR` and System R's query block:

- the IR covers `from`, `where`, equi-`join` or nested include, `orderBy` with a row-key tie-breaker, `limit`/`offset`, `select`, `groupBy` with `count`/`sum`/`avg`/`min`/`max`;
- compile expressions to closures;
- execute by recomputing with A's identity tricks;
- apply rule-based rewrites only: split ANDs, push single-source predicates to their source, hash-join with the smaller side as build side using exact sizes;
- use on-demand sorted or hash indexes keyed by `(collection, columns)`, kept for the collection's lifetime as Zero does, built lazily on first use.

| Pros                                                                                                                                                                                                      | Cons                                                                                                                                                                                 |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| The IR is the stable contract. Index use and pushdown come almost free. Hierarchical "include" results match `@goodstate`'s nested schema. Execution can later be replaced by C without changing the API. | Still recompute-per-change at the query level. Indexes must be maintained on every write, so the store has to tell them which rows changed. That is the same row-level feed C needs. |

**C. An incremental operator graph fed by row-level deltas.** Same IR as B, compiled to push-based operators over signed changes:

- `filter` and `map`, which are stateless;
- equi-join with indexed state;
- `distinct`;
- `groupBy` with invertible aggregates and group recompute for `min`/`max`;
- top-K over a total order.

Hydrate by pulling from indexes (Zero-style). Flush once per `Store.commit`.

This needs a change feed of `(collection, rowKey, before, after)` per commit. It can be derived from the existing delegate chain plus `View`'s identity cache: the `before` projection is the cached one, and `after` is the re-materialized one. A whole-root merge from a sync engine becomes a batch of row deltas.

| Pros                                                                                                          | Cons                                                                                                                                                                                                                                                                             |
| ------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Per-change cost proportional to the change for filter, join and top-K. Same contract as TanStack DB and Zero. | Largest implementation, comparable to `db-ivm` plus a compiler. Operator state costs memory (TanStack DB indexes both join sides). `RGA`'s missing total order must be replaced by an explicit `orderBy` plus a row-key tie-breaker. Needs the store API change ADR-08 deferred. |

**D. Adapt to TanStack DB.** Expose `@goodstate` collections as TanStack DB collections, in the way `rxdb-db-collection` and `electric-db-collection` exist in that repo, and use its live queries. `@tanstack/db-ivm` "doesn't depend on the TanStack DB and so could be used in other projects" ([`db-ivm/README.md`][td-ivm-readme] L5).

| Pros                                                                    | Cons                                                                                                                                                                                                                                               |
| ----------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| An existing, tested optimizer, IVM and index layer. Framework bindings. | A second materialization of every row (TanStack DB's collection state), a large dependency, and its semantics: version-free, `limit` requires `orderBy`, equality joins only. Optimistic-mutation and sync layers overlap with `@goodstate`'s own. |

### 6.3 Recommendation

1. **Start with B's IR and A's execution.**
   - The IR is the part that is expensive to change later, and it is what makes index use, pushdown and a future IVM possible.
   - Recomputation with identity memoization is what LiveStore, Dexie and DataScript ship. `materialized-view.md` §6 already argued it is defensible at local-first data sizes.
   - Do not build a cost-based join enumerator. With exact sizes and few joins per UI query, "build the hash table on the smaller side" covers the cases System R's dynamic programming was invented for.
   - Do not generate code with `Function()`. Compile expressions to closures.
2. **Require an explicit total order** (`orderBy` plus row key) wherever `limit`/`offset` is allowed. That holds whatever happens to `RGA` ordering, and it is what makes an incremental top-K possible later.
3. **Add the row-level change feed to `Store.commit` when the first index or incremental operator needs it.**
   - Record a `(collection, rowKey)` pair per changed row from the delegate chain, instead of only top-level fields. Keep the encoded per-field payload for the sync engines.
   - This revisits ADR-08's deferral. It should be its own ADR.
4. **Make operators incremental one at a time, behind the same IR**, in increasing order of state:
   1. filter and map;
   2. equi-join/include with indexed state, or Zero-style refetch through the source's indexes when memory matters more than CPU;
   3. top-K;
   4. aggregates, with `min`/`max` recomputing their group.
5. **Revisit D** if `@goodstate` needs partial or on-demand loading from a server. TanStack DB's `loadSubset` and lazy joins solve that problem, and none of A–C does.

---

## 7. What I could not verify

- **Performance.** No benchmarks were run. Every number above is the vendor's or paper author's own:
  - TanStack DB's ~0.7 ms row update;
  - the X100 and HyPer TPC-H results;
  - the db-ivm CHANGELOG speedups.
    Whether vectorized or array-at-a-time operators beat per-row closures in a JS JIT (§2.5) is not established by any source read here.
- **Doc quotes.** Quotes from the SQLite, PostgreSQL, DuckDB and MDN pages came through a fetch tool that returns extracted text. The wording was requested verbatim but could not be checked byte for byte. This includes SQLite's statement that N was later "raised to 12 or to 18 if the join is against a star-schema".
- **Paper sources.** The Volcano PDF came from a third-party mirror of the IEEE TKDE article. The Selinger PDF came from a Duke course mirror. Both texts match the published papers' titles, authors and venues, but they were not obtained from the publisher.
- **DuckDB's switch from pull to push.** The 2019 paper and the current docs and source show the before and after, not when or why it changed.
- **LiveStore.** Whether equality cutoff happens somewhere other than `reactive.ts` and the React hook (for example in other framework adapters) was not checked. The leader-thread materializer was not read for finer-grained change tracking.
- **RxDB EventReduce.** The `event-reduce-js` decision logic (its action list and when it returns `runFullQueryAgain`) lives in a separate package that was not cloned.
- **Dexie.** Whether `findCompatibleQuery`'s super-range match is ever used. The branch carries a TODO and appears to fall through to a fresh query.
- **DataScript.** No DataScript document says outright that clause order is the user's responsibility. The in-order evaluation is read from the code.
- **TanStack DB.**
  - Whether the builder maps the IR's `outer`/`cross` join types onto supported kinds, or whether they always reach `UnsupportedJoinTypeError`.
  - How post-snapshot source changes are filtered by a subscription's `where` (`createFilteredCallback`).
- **Zero.**
  - `planner/SELECTIVITY_PLAN.md`, referenced from `sqlite-stat-fanout.ts`, is missing from the checkout.
  - The server-side `pipeline-driver.ts` batching was not read.
  - The Noria resemblance in §4.4 is my reading, not a stated design lineage.
- **`@goodstate` change feed.** That a row-level feed can be derived from the delegate chain and `View`'s cache (§6.2 C) was reasoned from the code, not prototyped.

---

## References

[nn-mv]: ./materialized-view.md
[selinger]: https://courses.cs.duke.edu/compsci516/cps216/spring03/papers/selinger-etal-1979.pdf
[volcano]: https://paperhub.s3.amazonaws.com/dace52a42c07f7f8348b08dc2b186061.pdf
[x100]: https://www.cidrdb.org/cidr2005/papers/P19.pdf
[hyper]: https://www.vldb.org/pvldb/vol4/p539-neumann.pdf
[morsel]: https://db.in.tum.de/~leis/papers/morsels.pdf
[umbra]: https://www.cidrdb.org/cidr2020/papers/p29-neumann-cidr20.pdf
[duckdb-paper]: https://mytherin.github.io/papers/2019-duckdbdemo.pdf
[dd]: https://www.cidrdb.org/cidr2013/Papers/CIDR13_Paper111.pdf
[arrangements]: https://www.vldb.org/pvldb/vol13/p1793-mcsherry.pdf
[sqlite-arch]: https://www.sqlite.org/arch.html
[sqlite-opcode]: https://www.sqlite.org/opcode.html
[sqlite-opt]: https://www.sqlite.org/optoverview.html
[sqlite-ngqp]: https://www.sqlite.org/queryplanner-ng.html
[pg-path]: https://www.postgresql.org/docs/18/query-path.html
[pg-planner]: https://www.postgresql.org/docs/18/planner-optimizer.html
[pg-executor]: https://www.postgresql.org/docs/18/executor.html
[pg-stats]: https://www.postgresql.org/docs/18/planner-stats.html
[pg-index-types]: https://www.postgresql.org/docs/18/indexes-types.html
[pg-ios]: https://www.postgresql.org/docs/18/indexes-index-only-scans.html
[pg-config]: https://www.postgresql.org/docs/18/runtime-config-query.html
[duckdb-internals]: https://duckdb.org/docs/2.0/internals/overview.html
[duckdb-vector]: https://duckdb.org/docs/2.0/internals/vector.html
[mdn-csp]: https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/script-src
[duckdb-optimizer]: https://github.com/duckdb/duckdb/tree/756db2420813a1dadeded49d766313371997e194/src/optimizer
[duckdb-enum]: https://github.com/duckdb/duckdb/blob/756db2420813a1dadeded49d766313371997e194/src/optimizer/join_order/plan_enumerator.cpp#L628-L638
[duckdb-op]: https://github.com/duckdb/duckdb/blob/756db2420813a1dadeded49d766313371997e194/src/include/duckdb/execution/physical_operator.hpp#L106-L228
[duckdb-pipe]: https://github.com/duckdb/duckdb/blob/756db2420813a1dadeded49d766313371997e194/src/parallel/pipeline_executor.cpp#L560-L575
[td-ir]: https://github.com/TanStack/db/blob/21c52a07e6da3d388054224700cc69a800372f30/packages/db/src/query/ir.ts
[td-optimizer]: https://github.com/TanStack/db/blob/21c52a07e6da3d388054224700cc69a800372f30/packages/db/src/query/optimizer.ts
[td-compiler]: https://github.com/TanStack/db/blob/21c52a07e6da3d388054224700cc69a800372f30/packages/db/src/query/compiler/index.ts
[td-joins]: https://github.com/TanStack/db/blob/21c52a07e6da3d388054224700cc69a800372f30/packages/db/src/query/compiler/joins.ts
[td-join-conditions]: https://github.com/TanStack/db/blob/21c52a07e6da3d388054224700cc69a800372f30/packages/db/src/query/join-conditions.ts
[td-eval]: https://github.com/TanStack/db/blob/21c52a07e6da3d388054224700cc69a800372f30/packages/db/src/query/compiler/evaluators.ts#L99-L109
[td-ccb]: https://github.com/TanStack/db/blob/21c52a07e6da3d388054224700cc69a800372f30/packages/db/src/query/live/collection-config-builder.ts
[td-subscriber]: https://github.com/TanStack/db/blob/21c52a07e6da3d388054224700cc69a800372f30/packages/db/src/query/live/collection-subscriber.ts#L364
[td-live-utils]: https://github.com/TanStack/db/blob/21c52a07e6da3d388054224700cc69a800372f30/packages/db/src/query/live/utils.ts#L123-L146
[td-basic-index]: https://github.com/TanStack/db/blob/21c52a07e6da3d388054224700cc69a800372f30/packages/db/src/indexes/basic-index.ts#L28-L37
[td-auto-index]: https://github.com/TanStack/db/blob/21c52a07e6da3d388054224700cc69a800372f30/packages/db/src/indexes/auto-index.ts#L91-L105
[td-index-opt]: https://github.com/TanStack/db/blob/21c52a07e6da3d388054224700cc69a800372f30/packages/db/src/utils/index-optimization.ts
[td-overview]: https://github.com/TanStack/db/blob/21c52a07e6da3d388054224700cc69a800372f30/docs/overview.md#L157-L159
[td-ivm-readme]: https://github.com/TanStack/db/blob/21c52a07e6da3d388054224700cc69a800372f30/packages/db-ivm/README.md
[td-multiset]: https://github.com/TanStack/db/blob/21c52a07e6da3d388054224700cc69a800372f30/packages/db-ivm/src/multiset.ts#L4-L16
[td-d2]: https://github.com/TanStack/db/blob/21c52a07e6da3d388054224700cc69a800372f30/packages/db-ivm/src/d2.ts#L58-L75
[td-graph]: https://github.com/TanStack/db/blob/21c52a07e6da3d388054224700cc69a800372f30/packages/db-ivm/src/graph.ts#L36-L45
[td-join]: https://github.com/TanStack/db/blob/21c52a07e6da3d388054224700cc69a800372f30/packages/db-ivm/src/operators/join.ts#L9-L23
[td-reduce]: https://github.com/TanStack/db/blob/21c52a07e6da3d388054224700cc69a800372f30/packages/db-ivm/src/operators/reduce.ts#L41-L60
[td-topk]: https://github.com/TanStack/db/blob/21c52a07e6da3d388054224700cc69a800372f30/packages/db-ivm/src/operators/topKArray.ts#L57-L62
[z-builder]: https://github.com/rocicorp/mono/blob/cf5515dda6c38b1dfec2c9db560ce7d0f448f80c/packages/zql/src/builder/builder.ts
[z-filter]: https://github.com/rocicorp/mono/blob/cf5515dda6c38b1dfec2c9db560ce7d0f448f80c/packages/zql/src/builder/filter.ts#L50
[z-planner-graph]: https://github.com/rocicorp/mono/blob/cf5515dda6c38b1dfec2c9db560ce7d0f448f80c/packages/zql/src/planner/planner-graph.ts
[z-planner-join]: https://github.com/rocicorp/mono/blob/cf5515dda6c38b1dfec2c9db560ce7d0f448f80c/packages/zql/src/planner/planner-join.ts#L348-L349
[z-cost]: https://github.com/rocicorp/mono/blob/cf5515dda6c38b1dfec2c9db560ce7d0f448f80c/packages/zqlite/src/sqlite-cost-model.ts#L32-L108
[z-fanout]: https://github.com/rocicorp/mono/blob/cf5515dda6c38b1dfec2c9db560ce7d0f448f80c/packages/zqlite/src/sqlite-stat-fanout.ts#L40-L91
[z-qdb]: https://github.com/rocicorp/mono/blob/cf5515dda6c38b1dfec2c9db560ce7d0f448f80c/packages/zql/src/query/query-delegate-base.ts#L510
[z-operator]: https://github.com/rocicorp/mono/blob/cf5515dda6c38b1dfec2c9db560ce7d0f448f80c/packages/zql/src/ivm/operator.ts
[z-source]: https://github.com/rocicorp/mono/blob/cf5515dda6c38b1dfec2c9db560ce7d0f448f80c/packages/zql/src/ivm/source.ts#L62-L63
[z-change]: https://github.com/rocicorp/mono/blob/cf5515dda6c38b1dfec2c9db560ce7d0f448f80c/packages/zql/src/ivm/change.ts#L12-L57
[z-mem]: https://github.com/rocicorp/mono/blob/cf5515dda6c38b1dfec2c9db560ce7d0f448f80c/packages/zql/src/ivm/memory-source.ts
[z-join]: https://github.com/rocicorp/mono/blob/cf5515dda6c38b1dfec2c9db560ce7d0f448f80c/packages/zql/src/ivm/join.ts
[z-take]: https://github.com/rocicorp/mono/blob/cf5515dda6c38b1dfec2c9db560ce7d0f448f80c/packages/zql/src/ivm/take.ts
[z-aggregate]: https://github.com/rocicorp/mono/blob/cf5515dda6c38b1dfec2c9db560ce7d0f448f80c/packages/zql/src/ivm/aggregate.ts#L426-L451
[z-view-apply]: https://github.com/rocicorp/mono/blob/cf5515dda6c38b1dfec2c9db560ce7d0f448f80c/packages/zql/src/ivm/view-apply-change.ts#L155-L160
[z-view]: https://github.com/rocicorp/mono/blob/cf5515dda6c38b1dfec2c9db560ce7d0f448f80c/packages/zql/src/ivm/view.ts#L15-L29
[ls-reactive]: https://github.com/livestorejs/livestore/blob/b9af5a0b66ec35ba5d4f49a9937859059db6ff9d/packages/@livestore/livestore/src/reactive.ts
[ls-store]: https://github.com/livestorejs/livestore/blob/b9af5a0b66ec35ba5d4f49a9937859059db6ff9d/packages/@livestore/livestore/src/store/store.ts
[ls-wrapper]: https://github.com/livestorejs/livestore/blob/b9af5a0b66ec35ba5d4f49a9937859059db6ff9d/packages/@livestore/livestore/src/SqliteDbWrapper.ts#L64
[ls-db-query]: https://github.com/livestorejs/livestore/blob/b9af5a0b66ec35ba5d4f49a9937859059db6ff9d/packages/@livestore/livestore/src/live-queries/db-query.ts#L378-L392
[ls-cache]: https://github.com/livestorejs/livestore/blob/b9af5a0b66ec35ba5d4f49a9937859059db6ff9d/packages/@livestore/livestore/src/QueryCache.ts#L61-L69
[ls-usequery]: https://github.com/livestorejs/livestore/blob/b9af5a0b66ec35ba5d4f49a9937859059db6ff9d/packages/@livestore/react/src/useQuery.ts#L123
[rx-planner]: https://github.com/pubkey/rxdb/blob/3afc8964f4b5890ab4bb07f1efed88ef44f120e0/src/query-planner.ts
[rx-mem]: https://github.com/pubkey/rxdb/blob/3afc8964f4b5890ab4bb07f1efed88ef44f120e0/src/plugins/storage-memory/rx-storage-instance-memory.ts#L285-L412
[rx-er]: https://github.com/pubkey/rxdb/blob/3afc8964f4b5890ab4bb07f1efed88ef44f120e0/src/event-reduce.ts
[rx-er-doc]: https://github.com/pubkey/rxdb/blob/3afc8964f4b5890ab4bb07f1efed88ef44f120e0/docs-src/docs/event-reduce.md
[rx-query]: https://github.com/pubkey/rxdb/blob/3afc8964f4b5890ab4bb07f1efed88ef44f120e0/src/rx-query.ts#L807-L901
[dx-table]: https://github.com/dexie/Dexie.js/blob/95666bf5370a222a21d7f53130d87b42e9b7bac7/src/classes/table/table.ts
[dx-obs]: https://github.com/dexie/Dexie.js/blob/95666bf5370a222a21d7f53130d87b42e9b7bac7/src/live-query/observability-middleware.ts
[dx-rangeset]: https://github.com/dexie/Dexie.js/blob/95666bf5370a222a21d7f53130d87b42e9b7bac7/src/helpers/rangeset.ts#L12-L14
[dx-live]: https://github.com/dexie/Dexie.js/blob/95666bf5370a222a21d7f53130d87b42e9b7bac7/src/live-query/live-query.ts#L88-L99
[dx-optimistic]: https://github.com/dexie/Dexie.js/blob/95666bf5370a222a21d7f53130d87b42e9b7bac7/src/live-query/cache/apply-optimistic-ops.ts#L12
[ds-query]: https://github.com/tonsky/datascript/blob/34915cf673c02cbc64779fe56e0288d70fea63f8/src/datascript/query.cljc
[ds-db]: https://github.com/tonsky/datascript/blob/34915cf673c02cbc64779fe56e0288d70fea63f8/src/datascript/db.cljc
[ds-conn]: https://github.com/tonsky/datascript/blob/34915cf673c02cbc64779fe56e0288d70fea63f8/src/datascript/conn.cljc#L159
[nn-store]: ../../../packages/store/src/store.ts
[nn-view]: ../../../packages/store/src/projections/view.ts
[nn-versioned-cache]: ../../../packages/cache/src/versioned-cache.ts
[nn-entity]: ../../../packages/entities/src/entity.ts
[nn-rga]: ../../../packages/entities/src/rga.ts
[nn-lww-map]: ../../../packages/entities/src/lww-map.ts
[nn-react]: ../../../packages/react/src/index.ts
[adr08]: ../../decisions/ADR-08-report-sequence-changes-without-describing-them.md
[adr11]: ../../decisions/ADR-11-defer-the-ordering-crdt.md
[adr19]: ../../decisions/ADR-19-tombstone-removed-rows.md
