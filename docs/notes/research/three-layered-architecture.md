# Three-layered architecture: presentation, domain, data source

Researched 2026-11-09 using primary sources. Source assertions carry citations; recommendations, interpretations, and the TypeScript sketch are our synthesis. We didn't have the books themselves (Fowler's _Patterns of Enterprise Application Architecture_, Evans's _Domain-Driven Design_, Buschmann et al.'s _Pattern-Oriented Software Architecture_), so book content is cited only where the author restates it on a page they own.

## Definition and origin

Martin Fowler describes presentation-domain-data layering as "one of the most common ways to modularize an information-rich program": three broad layers for presentation (UI), domain logic (business logic), and data access. He names its main benefit as reducing "the scope of my attention": while working on domain logic he can mostly ignore the UI and treat the data source as an abstract set of functions. [1]

Fowler says this layering "drives the structure of P of EAA" (2002), though he didn't make it a pattern of its own there. [1; 6] Eric Evans's DDD Reference, his own summary of the 2004 book, states Layered Architecture as: "Partition a complex program into layers. Develop a design within each layer that is cohesive and that depends only on the layers below." The domain sits in one layer, isolated "from the user interface, application, and infrastructure code", so his version has four layers. "The key goal here is isolation." [7]

The idea is older than business applications. Dijkstra's 1968 THE multiprogramming system "admits a strict hierarchical structure" of levels, from processor allocation at level 0 up to user programs. Each level achieves an abstraction the levels above rely on; above the segment controller, "the actual storage pages having lost their identity". The team tested level by level, "adding (a portion of) the next level only after the previous level has been thoroughly tested." [8]

**Interpretation:** Dijkstra's levels are abstraction levels inside an operating system, not presentation, domain, and data. What carries over is the ordering rule and the testing argument. We found no first-party source that claims to have invented the specific three-layer split; Fowler presents it as common practice, not as his invention. [1]

## The three layers and their responsibilities

Fowler's web example has a layer that "knows about handling HTTP requests and rendering HTML", a business logic layer that "contains validations and calculations", and a data access layer that "sorts out how to manage persistent data in a database or remote services". [1] Microsoft's _Application Architecture Guide_ (2nd ed., 2009) is similar: the **presentation layer** manages "user interaction with the system", the **business layer** "encapsulates the relevant business logic", and the **data layer** "exposes generic interfaces that the components in the business layer can consume." [9]

Fowler is categorical about the presentation-domain boundary: the domain "should be utterly unaware of what presentations may be used with it", and "the presentation is able to call the domain but not vice-versa." [2]

## Dependency direction

All the sources agree that dependencies point downward. Fowler: "presentation depends on the domain, which then depends on the data source." [1] Azure guidance: "A higher layer can use services in a lower layer, but a lower layer can't use services in a higher layer." [10] Evans: each layer "depends only on the layers below", with "loose coupling to the layers above." [7] At a 2005 workshop Fowler reports on, "Lower layers should not depend on upper layers" won 6 votes to 0, though he cautions that "you can't read too much into this list." [4]

The lower layer still needs to tell the upper one that something changed. Fowler: "Observer is the usual solution to this problem"; the domain fires an event and the presentation observes it, so the domain keeps no reference to the presentation. [2] Microsoft gives the same advice: "You can use events to make components in higher layers aware of changes in lower layers without introducing dependencies." [9]

Within that downward direction, the sources name two variants. Microsoft's 2009 guide calls them **strict interaction**, where "each layer must interact with only the layer directly below", and **loose interaction**, where "higher level layers can bypass layers to interact with lower level layers directly", which "can improve performance, but will also increase dependencies." [9] The Azure guide calls the same pair a **closed** and an **open** layer architecture; a closed one "limits the dependencies between layers" but may add traffic when a layer only passes requests along. [10] The 2009 guide also allows layers to be collapsed: an application with very limited business rules "might implement both the business and presentation logic in a single layer." [9] **Terminology note:** the sources we read say strict/loose, closed/open, and "collapse or relax layers"; if the thesis says "strict" and "relaxed", it should define them by these. [9; 10]

## Layers are not tiers

Fowler: "These layers are logical layers not physical tiers." [1] Microsoft: "*Layers* describe the logical groupings of the functionality and components in an application; whereas *tiers* describe the physical distribution of the functionality and components on separate servers, computers, networks, or remote locations." Both use the same names, but "only tiers imply a physical separation". [9] Azure describes a "traditional three-tier application" as "a presentation tier, an optional middle tier, and a database tier", and you "can host several layers on the same tier." [10]

The distinction matters because distribution has a cost. Fowler's First Law of Distributed Object Design, coined in PoEAA, is "don't distribute your objects": remote calls are "orders of magnitude slower" and need coarse-grained interfaces, so one class can't serve both roles. [5] The workshop rejected "Distribute at layer boundaries" 0 votes to 18. [4] Microsoft advises distributing layers across tiers "only where this is necessary". [9]

**Interpretation:** "three-tier" says where code runs; "three-layered" says how code depends on other code. A three-tier system can contain no domain layer at all, and a single-process application can be cleanly three-layered.

## Costs and criticisms

**Changes cut across layers.** Fowler: "separate presentation-domain-data modules often do have to change together. The simple act of adding a data field will usually cause all three to update." He therefore favours the layering "in smaller scopes", while "larger applications need high level modules to be developed along different lines." [3] On the bliki he says the layering "should only be applied at a relatively small granularity". Once a layer "gets too big", the top level should be split into "domain oriented modules which are internally layered." [1] He calls dividing teams by layer an antipattern, and the workshop rejected "Separate development teams by layer" 1 to 22. [1; 4]

**Layer boundaries leak.** Cockburn: "people tend not to take the 'lines' in the layered drawing seriously. They let the application logic leak across the layer boundaries". He also objects that an application may have more than two ports, which a one-dimensional stack can't show. [11]

**Database at the bottom.** In Palermo's reading of traditional layering, "each layer is coupled to the layers below it", and "the biggest offender (and most common) is the coupling of UI and business logic to data access". Because "transitive dependencies are still dependencies", the UI is coupled to data access too. [12] His answer is "the database is not the center". [12]

**Indirection without value.** Microsoft warns that too few or too many layers "can add unnecessary complexity" and that crossing layer boundaries "imposes a local performance overhead". [9] Fowler adds that, although data access substitution is often cited as a driver, "I rarely hear of someone actually doing it." [1]

## Relationship to hexagonal, onion, and clean

Fowler describes the common variant in which "the domain does not depend on its data sources by introducing a mapper between the domain and data source layers" and says it is "often referred to as a Hexagonal Architecture." [1] Evans says that patterns such as Hexagonal Architecture "may serve as well or better" when they let the domain avoid references to other concerns. [7] That variant keeps presentation above domain but reverses the domain-to-data arrow. Ports and adapters, Onion's inward rule, and Clean's synthesis are covered in [hexagonal-architecture.md](hexagonal-architecture.md) and aren't repeated here.

**Our assessment:** three-layered architecture is the baseline these patterns argue with. The presentation-over-domain rule survives in all of them. The data-source-at-the-bottom rule is the one they reject.

## A small TypeScript sketch

Our sketch of moving the example app's ticket rule (now in a React component, see below) into a plain function over the store's draft. It type-checks against the current `example-schema`.

```ts
import type { InferStateType } from "@nn/schema";
import type { schema } from "example-schema";

type Board = InferStateType<typeof schema>;
type Ticket = Board["tickets"][number];

export function addTicket(board: Board, input: Omit<Ticket, "id">): void {
	const title = input.title.trim();

	if (title === "") throw new Error("A ticket needs a title");

	board.tickets.push({ ...input, id: crypto.randomUUID(), title });
}
```

A component would call `updateStore((data) => addTicket(data, draft))`, and the rule can be tested without React or a sync engine. [1]

## Examples in this repository

**Presentation over domain fits.** [`@nn/react`](../../../packages/react/src/index.ts) imports `Store` and wraps it in `useRead` and `useUpdate`. [`Store`](../../../packages/store/src/store.ts) imports nothing from React. It reports changes through `onChange`, which is backed by [`Observable`](../../../packages/observable/src/observable.ts). This is the Observer arrangement Fowler and Microsoft describe for upward notification without an upward dependency. [2; 9] Components such as [`column`](../../../apps/example-react/src/components/column/index.tsx) read through `useRead` and never touch persistence.

**The domain layer is generic, not business logic.** `@nn/store`, `@nn/entities`, and `@nn/schema` hold state, reconciliation, and CRDT merging. They know nothing about tickets or users. The application's model is the shape declared in [`example-schema`](../../../apps/example-schema/src/index.ts), and its rules sit in presentation: [`ticket-modal`](../../../apps/example-react/src/components/ticket-modal/index.tsx) trims the title, generates the id, and validates the form inside the component. **Our assessment:** this is a collapsed business layer in Microsoft's terms, acceptable for "an application with very limited business rules". [9] The sketch above shows where the rules would go if they grow.

**Data source depends on the domain, not the reverse.** Under [ADR-13](../../decisions/ADR-13-attach-persistence-and-sync-from-outside-the-store.md), `Store` has no repository or remote. [`SyncEngine`](../../../packages/sync-engine/src/sync-engine.ts) imports `Store` and calls `store.merge`, `store.encode`, and `store.onChange`. [`IndexDbSync`](../../../packages/indexdb-sync/src/index-db-sync.ts), [`SseSync`](../../../packages/sse-sync/src/sse-sync.ts), and [`BroadcastSync`](../../../packages/broadcast-sync/src/broadcast-sync.ts) extend it. Read as a stack, this is a lower layer that depends on the layer above, which layering forbids. [7; 10] It matches the variant Fowler calls hexagonal, except that the store declares no data-source interface; the engines adapt to its public API. **Interpretation:** describe the client as presentation over a domain core, with sync engines as driven adapters beside the core rather than a layer beneath it.

**Assembly is outside every layer.** [`apps/example-react/src/store.ts`](../../../apps/example-react/src/store.ts) creates the store, constructs and connects the three sync engines, and wires `online` and `visibilitychange` to `remote.retry()`.

**Tiers are not layers here either.** All three client layers run in the browser tier. The [sync server](../../../apps/example-react/api/_server/routes/sync.ts) is a separate tier. It is internally layered (Hono routes over a [`Database`](../../../apps/example-react/api/_server/services/database/database.ts) interface with in-memory and Redis implementations), but it has no domain layer. [`createMemoryDatabase`](../../../apps/example-react/api/_server/services/database/memory-database.ts) stores pushed entries with `Object.assign`, and all merging happens on the client. **Our assessment:** for a local-first system that is intended (see [local-first-software.md](local-first-software.md)), but it means the thesis shouldn't call the system three-tier in the classic sense.

## Sources

All accessed 2026-11-09.

1. Martin Fowler, [Presentation Domain Data Layering](https://martinfowler.com/bliki/PresentationDomainDataLayering.html), 2015-08-26. Three layers, dependency direction, layers versus tiers, granularity, hexagonal variant.
2. Martin Fowler, [Separated Presentation](https://martinfowler.com/eaaDev/SeparatedPresentation.html), 2006-06-29. One-way presentation-to-domain dependency, Observer for upward notification, logical layers.
3. Martin Fowler, [Refactoring Module Dependencies](https://martinfowler.com/articles/refactoring-dependencies.html), 2015-10-13. Layers changing together, smaller scopes.
4. Martin Fowler, [Layering Principles](https://martinfowler.com/bliki/LayeringPrinciples.html), 2005-01-07. Workshop vote on layering principles; votes, not endorsements.
5. Martin Fowler, [Microservices and the First Law of Distributed Objects](https://martinfowler.com/articles/distributed-objects-microservices.html), 2014-08-13. Restates PoEAA's First Law of Distributed Object Design.
6. Martin Fowler et al., [Patterns of Enterprise Application Architecture](https://martinfowler.com/books/eaa.html), 2002. Book page only; the Layering chapter itself wasn't consulted.
7. Eric Evans, [Domain-Driven Design Reference](https://domainlanguage.com/wp-content/uploads/2016/05/DDD_Reference_2015-03.pdf), Domain Language, 2015-03, p. 10 "Layered Architecture". Author's own summary of the 2004 book.
8. Edsger W. Dijkstra, [The structure of the "THE"-multiprogramming system](https://www.cs.utexas.edu/~EWD/transcriptions/EWD01xx/EWD196.html), EWD 196, published in _Communications of the ACM_ 11(5), 1968, pp. 341–346. Transcription in the E. W. Dijkstra Archive.
9. Microsoft patterns & practices, [Chapter 5: Layered Application Guidelines](https://learn.microsoft.com/en-us/previous-versions/msp-n-p/ee658109(v=pandp.10)), _Microsoft Application Architecture Guide_, 2nd ed., archived page dated 2010-01-13. Layer definitions, layers versus tiers, interaction rules.
10. Microsoft, [N-tier architecture style](https://learn.microsoft.com/en-us/azure/architecture/guide/architecture-styles/n-tier), Azure Architecture Center, 2025-08-15. Layers versus tiers, closed and open layers, three-tier definition.
11. Alistair Cockburn, [Hexagonal architecture: the original 2005 article](https://alistair.cockburn.us/hexagonal-architecture/), 2005. Critique of layered drawings.
12. Jeffrey Palermo, [The Onion Architecture: part 1](https://jeffreypalermo.com/2008/07/the-onion-architecture-part-1/), 2008-07-29. Transitive coupling to data access in traditional layering.
