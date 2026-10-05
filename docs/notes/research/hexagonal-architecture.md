# Hexagonal architecture: ports and adapters

Researched 2026-10-05 using primary sources. Source assertions carry citations; recommendations and the TypeScript sketch are our synthesis, not additional rules imposed by the original pattern.

## Definition and intent

Alistair Cockburn's 2005 paper names the pattern **Ports and Adapters**, with **Hexagonal Architecture** as an alternative name. Its intent is to let users, programs, automated tests, and batch scripts drive the same application, and to develop and test that application independently of its eventual devices and databases. The central distinction is **inside versus outside**, not UI above business logic above a database. [1]

Cockburn identifies the same problem on both sides: business logic becomes entangled with presentation or external services. His proposed check is practical: expose application functionality through APIs and run it headlessly with test drivers and replacement external services. The hexagon provides drawing space for several conversations; six sides do not require six ports. [1]

## Ports, adapters, and who drives

A **port** identifies a purposeful conversation with the application. Its protocol is an API. An **adapter** translates between that protocol and a particular technology. Several adapters can serve one port: a GUI, an HTTP endpoint, and a test harness can drive the same application capability; SQL, a file, and an in-memory substitute can satisfy the same storage conversation. Ports describe purposes, rather than individual technologies. [1, “Nature of the Solution”]

Cockburn distinguishes two roles by who initiates or controls the conversation: [1, “The Left-Right Asymmetry”]

| Role               | Direction of initiative                                          | Examples                                  |
| ------------------ | ---------------------------------------------------------------- | ----------------------------------------- |
| Primary / driving  | An external actor asks the application to act                    | User interface, batch job, automated test |
| Secondary / driven | The application asks an external actor for information or action | Database, notification service, device    |

**Interpretation:** “input” and “output” are useful shorthand only if they preserve this distinction. A repository returning data is still driven; its response doesn't make it a driving port. A message consumer can be a driving adapter, while a message publisher can be driven. Classify the conversation, not the transport. This follows Cockburn's initiative-based definition. [1]

Port granularity is deliberately flexible. Cockburn discusses both one port per use case and only two broad ports, calls neither extreme optimal, and leaves the choice largely to judgment. A port is therefore not necessarily one class, method, or network endpoint. [1, “How Many Ports?”]

## Dependencies and the application boundary

The application should not know which input device or external storage implementation sits beyond an adapter. Cockburn's example injects a `RateRepository` interface into a discount calculator, allowing replacement of the database adapter. His related-patterns section connects this to dependency inversion and dependency injection. [1]

**Recommended TypeScript arrangement:** define the contracts needed by the application alongside its core code. Driving adapters call its public API; driven adapters implement its required contracts. Bootstrap code selects and connects implementations. Runtime calls can travel outward to a database adapter even though the core's source imports never point to that adapter. Martin explicitly distinguishes control flow from source dependency direction; Fowler explains separating assembly from use. [3, “Crossing boundaries”; 4]

Dependency inversion concerns which abstractions code depends on; injection supplies an implementation. Passing a function or object is enough for the sketch below. A container is optional, not a hexagonal requirement: Cockburn explicitly permits direct wiring or framework configuration. [1; 4]

Cockburn places use-case specifications at the **application boundary**, independent of external technology. He does not prescribe a separate domain layer, entity hierarchy, folder tree, or four internal rings. **Our recommendation:** when complexity warrants it, separate domain rules from application workflows inside that boundary. Keep transport parsing and persistence mapping in adapters. That internal split is a design choice, not the definition of hexagonal architecture. [1, “Use Cases And The Application Boundary”; 3]

## A small TypeScript sketch

This is our adaptation of Cockburn's first-party discount example. It uses an asynchronous function for the driven port and another function for the driving API. The nonnegative-amount rule is illustrative. [1, “Sample Code”]

```ts
export type RateLookup = (amount: number) => Promise<number>;

export type Discounter = (amount: number) => Promise<number>;

export function createDiscounter(lookupRate: RateLookup): Discounter {
	return async (amount) => {
		if (!Number.isFinite(amount) || amount < 0) {
			throw new Error("Amount must be finite and nonnegative");
		}
		return amount * (await lookupRate(amount));
	};
}

export async function handleDiscountMessage(input: unknown, discount: Discounter): Promise<number> {
	if (typeof input !== "number") {
		throw new Error("Expected a numeric message");
	}
	return discount(input);
}

const fixedRate: RateLookup = async () => 0.05;
const discount = createDiscounter(fixedRate);
```

`handleDiscountMessage` is a driving adapter: it checks an external value's shape before calling the application. `fixedRate` is a driven test adapter. A database implementation would perform its lookup behind `RateLookup`; bootstrap code would pass it to the same factory. No interface-per-class machinery is needed for this example.

One possible layout, not a required structure:

```text
src/core/discount.ts
src/adapters/discount-message.ts
src/adapters/sql-rate-lookup.ts
src/bootstrap.ts
tests/discount.test.ts
tests/sql-rate-lookup.test.ts
```

**Practical limits:** this is a boundary example, not production money arithmetic. We'd need explicit contracts for rounding, rate validity, missing data, and failures. We'd also keep driver-specific records out of `RateLookup`; translating external data into core-friendly forms follows the adapter role and Martin's boundary guidance. [1; 3, “What data crosses the boundaries”]

## Testing

Testing is part of Cockburn's motivation, not an incidental benefit. His development sequence starts with a test driver and replacement database, adds a GUI, then exercises the application against a real test database. He uses “mock” broadly for an in-memory secondary actor, rather than requiring interaction expectations on every object. [1, “Structure”; “Mock Objects and Loopback”]

**Recommended test split, extending that approach:**

1. Drive application use cases directly with deterministic secondary adapters. Here, a fixed rate of `0.05` makes `discount(100)` return `5`; test invalid amounts and dependency failures too.
2. Test adapters against their actual boundaries. Check message parsing separately, and database queries, mapping, and error handling against a real test database. Shared contract tests can check that fake and real adapters honor the same observable promises.
3. Keep a small set of end-to-end checks for wiring and real user flows. Core tests cannot establish that deployment configuration, database behavior, or presentation works.

The last two recommendations address the limits of substitution; isolated tests alone aren't evidence that external integrations work. Cockburn's own integration-testing stage supports retaining that distinction. [1]

## Layered, Onion, and Clean architectures

**Layered:** Cockburn criticizes one-dimensional layer drawings for encouraging logic leaks and hiding applications with several ports. He also redraws his own example as three layers. Hexagonal architecture therefore isn't incompatible with layers; its defining emphasis is the protected application boundary and interchangeable external conversations. [1, “Nature of the Solution”; “Structure”]

**Onion:** Jeffrey Palermo's 2008 formulation explicitly puts a domain model at the center, allows dependencies only toward more central layers, and places UI, infrastructure, and tests outside the core. Repository interfaces live inside, with implementations outside. Palermo acknowledges the shared hexagonal premise of externalizing infrastructure through adapters. Onion adds an explicit domain-centered internal organization; its layer count can vary. [2]

**Clean:** Robert Martin's 2012 article explicitly synthesizes Hexagonal, Onion, and other approaches. It distinguishes entities, application use cases, interface adapters, and frameworks/drivers. Its overriding rule is inward-pointing source dependencies, including data-format dependencies. Martin says the four circles are schematic, not a mandatory count. [3]

**Synthesis:** these are overlapping approaches, not mutually exclusive templates. We can describe external interactions with ports and adapters while organizing the interior using Onion or Clean. We shouldn't attribute all of Clean's internal boundaries to Cockburn's original pattern. [1–3]

## Advantages, costs, and when to use it

**Source-backed benefits:** Cockburn emphasizes isolated regression testing, reusable headless application functionality, and reduced dependence on unfinished or unavailable infrastructure during development. Palermo targets long-lived business applications with complex behavior and explicitly excludes small websites from his Onion recommendation. These are authors' design arguments, not measured guarantees of lower cost. [1; 2]

**Our assessment:** ports are useful when application rules need independent testing, multiple callers share workflows, or external services change independently. The costs are additional contracts, translation code, wiring, navigation, and maintaining realistic substitutes. Database replacement still requires compatible semantics, migration, and integration work; an interface doesn't make those disappear.

For a small CRUD endpoint or short-lived script, a full folder-and-interface framework can cost more than it saves. We'd start with a callable application function and isolate the external dependency that actually obstructs testing or change. Add boundaries when they protect meaningful behavior, rather than creating an adapter for every helper. This is a recommendation informed by the sources, not a size threshold Cockburn mandates.

## Examples in this repository

The current code already illustrates the contract-and-adapter split:

- [`Repository`](../../../packages/repository/src/Repository.ts) defines a storage contract, and [`IndexDbRepository`](../../../packages/index-db-repository/src/IndexDbRepository.ts) implements it using IndexedDB.
- [`Store`](../../../packages/store/src/Store.ts) accepts that contract without importing the IndexedDB implementation. Its [tests](../../../packages/store/src/Store.test.ts) supply a replacement repository.
- [`Remote`](../../../packages/remote/src/Remote.ts) and [`HttpRemote`](../../../packages/http-remote/src/HttpRemote.ts) provide another contract-and-adapter pair. `Store` currently accepts the remote but doesn't use it, so this pair doesn't establish a working synchronization flow.
- The [React example's setup](../../../apps/example-react/src/store.ts) selects concrete adapters and passes them to `createStore`, illustrating assembly outside the core.

**Our assessment:** these are useful existing boundaries, rather than evidence that every part of the repository follows hexagonal architecture. The next useful question is whether each contract captures the behavior its caller needs, including failure and consistency semantics. Adding more folders alone wouldn't strengthen that boundary.

## Sources

All accessed 2026-10-05.

1. Alistair Cockburn, [Hexagonal architecture: the original 2005 article](https://alistair.cockburn.us/hexagonal-architecture/). HaT Technical Report 2005.02; displayed version dated 2005-09-04. Definition, roles, testing sequence, and original Java example.
2. Jeffrey Palermo, [The Onion Architecture: part 1](https://jeffreypalermo.com/2008/07/the-onion-architecture-part-1/), 2008-07-29. Original domain-centered layering and dependency rule.
3. Robert C. Martin, [The Clean Architecture](https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html), 2012-08-13. Explicit synthesis, dependency rule, internal layers, and boundary data.
4. Martin Fowler, [Inversion of Control Containers and the Dependency Injection pattern](https://martinfowler.com/articles/injection.html), 2004-01-23. Injection and separation of configuration from use.
