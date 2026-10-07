---
author: Petr Chalupa
date: 2026-10-01
---

# ADR-02: Use UUID v4 for generated identities

## Context

This library is local-first. Devices need to create entities independently, including while offline, and retain their identities when data is stored or merged with another replica. ID generation must be fast and require no network requests, central allocator, or worker registration.

An ID identifies an entity. When we need time ordering, we use [`Time`](../../packages/time/src/Time.ts) separately. We therefore don't need the ID to encode a timestamp or sort in creation order. Our earlier entity generator combined a timestamp, a counter, and a short random replica suffix; retaining it would mean maintaining our own uniqueness and clock-handling rules.

## Decision

We use [UUID v4 as defined in RFC 9562](https://www.rfc-editor.org/rfc/rfc9562.html#section-5.4) for newly generated identities across the library. It provides 122 random bits without incorporating a clock or requiring coordination between generators. We accept probabilistic uniqueness in exchange for independent generation.

[`@nn/id`](../../packages/id/src/ID.ts) exposes `ID.create(): string`, which delegates to the runtime's native [`crypto.randomUUID()`](https://w3c.github.io/webcrypto/#Crypto-method-randomUUID). We use the native cryptographic random source and UUID encoding rather than maintain either ourselves. This adds no runtime package dependency or library-managed generator state.

```ts
import { ID } from "@nn/id";

const key = ID.create();
```

The result is an opaque string. Consumers compare it for equality and carry it through storage and synchronization. [`Entity.key`](../../packages/entities/src/Entity.ts) generates it lazily on first access and retains it for the entity's lifetime. A supplied key is preserved exactly, including a legacy non-UUID key; this decision governs generation, not validation of existing identities.

## Alternatives considered

**UUID v7 or ULID.** [UUID v7](https://www.rfc-editor.org/rfc/rfc9562.html#section-5.7) and [ULID](https://github.com/ulid/spec) support local generation with timestamp-based sorting. We rejected them because ordering is a separate concern here. Their clock input and optional monotonic state add behavior we don't need, and timestamp sorting still doesn't establish causal or commit order across replicas.

**Database sequences or allocated ranges.** A [database sequence](https://www.postgresql.org/docs/18/functions-sequence.html) can assign distinct integers within its managed namespace. Allocating ranges reduces how often a producer contacts the allocator, but an offline producer eventually exhausts its range. We rejected both because generating identities must remain independent of an allocator's availability.

**Snowflake-style IDs.** [Snowflake](https://github.com/twitter-archive/snowflake/tree/snowflake-2010) combines a timestamp, worker identity, and counter into a compact integer. Ordinary generation is local, but worker identities must be assigned safely and clock rollback handled. We rejected these operational requirements for independent clients and replicas.

## Consequences

We can generate identities offline without reserving ranges or registering replicas. Native generation also keeps the implementation small. On 2026-10-01, a [focused benchmark](../superpowers/plans/2026-10-01-shared-id.md#benchmark-results) measured about 12.3 million `ID.create()` calls per second on Node.js v26.8.2, macOS arm64. This supports the choice for that runtime; it isn't a cross-runtime performance guarantee.

We accept a nonzero collision probability and depend on the runtime's cryptographic randomness. A collision can make unrelated entities appear to share an identity during a merge. This design doesn't provide a global collision check or a repair protocol for identities already distributed to other replicas.

We also accept 36-character keys and the loss of chronological key sorting. Consumers that previously compared keys to infer time must use explicit `Time` values. Random keys can have worse B-tree insertion locality than time-ordered keys, as described in [RFC 9562's update rationale](https://www.rfc-editor.org/rfc/rfc9562.html#section-2.1); generation throughput alone doesn't establish storage performance.

The runtime must expose native `crypto.randomUUID()`. Browsers require a secure context. If generation is unavailable or fails, the call throws; we don't silently substitute weaker randomness.

Existing keys remain valid and need no migration. Collections, repositories, and synchronization code must preserve them rather than replace them with newly generated UUIDs. Callers that supply their own keys remain responsible for their uniqueness.
