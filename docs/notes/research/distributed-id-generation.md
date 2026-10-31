# ID generation in distributed systems

Researched 2026-10-01 using specifications, official documentation, and original implementations. Recommendations and mathematical examples below are synthesis, distinguished from guarantees made by a particular implementation.

**Start with the required scope and ordering.** A database sequence can guarantee distinct allocations inside one managed namespace. Random IDs make independent, offline generation practical by accepting a very small collision probability. Time-prefixed IDs add useful sorting, but they don't establish causality or transaction commit order. RFC 9562 explicitly distinguishes practical UUID uniqueness from guaranteed global uniqueness without shared knowledge. [RFC §6.8][rfc-uniqueness]

## 1. Comparison

Sizes describe the identifier payload or canonical text, excluding database row and index overhead. “Local generation” means no network request for each ID; initial allocation or configuration may still require coordination.

| Scheme                  | Representation                                        | Basis of uniqueness                                                                        | Ordering                                                                   | Coordination and main limitation                                                                            |
| ----------------------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Central sequence        | Commonly a 64-bit integer                             | One allocator never reissues a value, within its namespace                                 | Allocation order under suitable settings; not commit order                 | Reach allocator; preserve state across failover; gaps are normal. [PostgreSQL][pg-sequence]                 |
| Range allocation / HiLo | Commonly a 64-bit integer                             | Disjoint allocated ranges plus a local counter                                             | Within each range; ranges can be consumed out of order                     | Contact allocator per block; must not reissue reserved values. [Npgsql][hilo]                               |
| UUIDv4                  | 128 bits; 36 text characters                          | 122 random bits; probabilistic                                                             | No time order                                                              | Local, clock-independent; relies on randomness. [RFC §5.4][rfc-v4]                                          |
| UUIDv7                  | 128 bits; 36 text characters                          | 48-bit Unix millisecond timestamp plus 74 bits available for randomness/counters/fractions | Timestamp-prefix order; same-millisecond monotonicity depends on generator | Local; clock and state policy matter. [RFC §5.7][rfc-v7]                                                    |
| UUIDv1 / v6             | 128 bits; 36 text characters                          | 60-bit timestamp, 14-bit clock sequence, 48-bit node field                                 | v1 field layout isn't naturally chronological; v6 reorders timestamp       | Local with appropriate node/state handling; legacy and privacy concerns. [RFC §5.1][rfc-v1], [§5.6][rfc-v6] |
| Twitter Snowflake       | 64-bit integer, 63 used bits in the documented layout | Distinct machine identity plus timestamp and counter                                       | Rough time order across workers; increasing within a live worker           | Allocate machine identities; handle rollback, restart, and exhaustion. [Original source][snow-worker]       |
| ULID                    | 128 bits; 26 Base32 characters                        | 48-bit Unix millisecond timestamp plus 80-bit random field                                 | Timestamp-prefix order; monotonic factory adds local ordering              | Local; monotonic state is per factory, not global. [Spec][ulid-spec], [implementation][ulid-js]             |
| Nano ID, default        | 21 characters, 126 random bits                        | Uniform secure random selection from 64 symbols                                            | No time order                                                              | Local, clock-independent; shortening changes collision risk. [Project docs][nanoid-doc]                     |
| UUIDv5                  | 128 bits; 36 text characters                          | Hash of namespace and canonical name                                                       | No time order; repeat inputs intentionally repeat IDs                      | Agree on namespace and canonicalization; hash collisions remain possible. [RFC §5.5][rfc-v5]                |
| Content address         | Hash/format dependent                                 | Hash of an encoded content representation                                                  | No creation order                                                          | Agree on encoding and hashing; identifies content rather than a mutable entity. [IPFS][ipfs]                |

## 2. Uniqueness scope and collision probability

Define whether an ID must be unique within a table, tenant, database, deployment, or every dataset that might later be merged. Two independent sequences can both validly issue `42`. A composite `(tenantId, localId)` can be unique even though `localId` alone isn't. The same reasoning applies to `(replicaId, counter)`: the replica IDs must be distinct and counters must not repeat. These are consequences of partitioning an ID namespace, not automatic properties of the integer representation. [PostgreSQL sequence scope][pg-sequence], [RFC distributed generation][rfc-distributed]

For **independent, uniformly random** IDs with `b` random bits, there are `M = 2^b` possible values. The probability of at least one collision after `n` draws is:

```text
p = 1 - product(1 - k/M, k = 0 … n-1)
  ≈ 1 - exp(-n(n-1)/(2M))
  ≈ n(n-1)/(2M), when this probability is small
```

This is a mathematical derivation: each new draw must avoid all previous values. It concerns **any pair** in the full population, not just collision with one chosen ID. For a billion IDs, the estimates are approximately `9.4 × 10^-20` for UUIDv4's 122 random bits and `5.9 × 10^-21` for default Nano ID's 126 bits. A uniformly random **64-bit** ID at the same population has about a **2.7%** chance of at least one collision. A structured 64-bit Snowflake ID uses a different uniqueness argument. Bit counts: [RFC §5.4][rfc-v4], [Nano ID][nanoid-doc].

For UUIDv7 with a fully random 74-bit suffix, compare IDs sharing the **same encoded millisecond**. At low probabilities, sum `n_t(n_t-1)/(2 × 2^74)` across timestamp buckets. Plain random ULIDs use 80 bits in the analogous calculation. Include all producers and all revisits to a timestamp after rollback. Don't apply these independent-draw formulas unchanged to monotonic counters or generators that replace random bits with sub-millisecond time. [RFC §5.7][rfc-v7], [ULID spec][ulid-spec]

These estimates assume the generator works correctly. They don't cover duplicated PRNG state, fixed seeds, biased alphabets, or truncation. RFC 9562 recommends a cryptographically secure pseudorandom number generator (CSPRNG) and proper reseeding after state changes such as forks. [RFC §6.9][rfc-random]

**Practical recommendation:** enforce a unique key at the storage boundary where possible. A random-ID collision detected before publication can be retried. An offline collision discovered after references have spread needs an explicit repair policy; silently treating it as an update can merge unrelated entities. Local constraints alone don't establish uniqueness across disconnected databases. This recommendation follows from the scope and collision distinctions above.

## 3. Central sequences, ranges, and HiLo

PostgreSQL's `nextval` is atomic: concurrent sessions receive distinct values from the same sequence. This assumes that administration doesn't rewind it or enable reuse through cycling. Sequence consumption isn't rolled back when a transaction aborts, so gaps are expected. A sequence isn't a gapless invoice-numbering protocol. [Sequence functions][pg-sequence], [CREATE SEQUENCE][pg-create-sequence]

Ordering needs qualification even here. PostgreSQL documents that `CACHE > 1` lets session A reserve `1…10` and session B reserve `11…20`; B may return `11` before A returns `2`. With cache one, allocation is sequential, but transactions can still finish in a different order: A reserves `1` and pauses, B reserves `2` and commits, then A commits. The latter is a consequence of allocating before commit. [CREATE SEQUENCE, Notes][pg-create-sequence]

**Range allocation** moves coordination off the per-ID path. A general HiLo model gets a unique high value `h`, then uses `h × B + l` for `0 ≤ l < B`. Another implementation can allocate the range's starting value directly. Npgsql's documented HiLo strategy uses a sequence incrementing by the block size, 100 by default, so the application generates 100 values before asking again. The formula and Npgsql mechanism describe the same partitioning idea, not one universal HiLo wire format. [Npgsql HiLo][hilo]

The operational consequences are straightforward:

- Larger blocks reduce allocation calls but can leave more unused values after a crash.
- A disconnected producer can continue only while its reserved range lasts.
- An allocated range must be durable before IDs escape. PostgreSQL explicitly says to commit `nextval` before using its result persistently outside the database. [PostgreSQL][pg-sequence]
- Treat “range leasing” carefully: a timeout doesn't erase IDs already issued. Reassigning a range requires preventing the former holder from continuing and proving that values won't be reused. Permanent reservation with abandoned gaps is the simpler design. This is a correctness requirement derived from range disjointness.

Failover is part of the allocation protocol. PostgreSQL 18 logical replication copies table values but **does not replicate sequence state**; promoting a subscriber requires updating its sequences. That statement is specific to logical replication, not all PostgreSQL replication. For range allocators, recovery must also account for outstanding reservations, not only `MAX(id)` among inserted rows. [PostgreSQL restrictions][pg-replication]

## 4. UUIDs under RFC 9562

RFC 9562, published in May 2024, supersedes RFC 4122. All these UUIDs occupy 128 bits, with version and variant bits determining the layout. [RFC][rfc]

- **v4:** 122 random bits, with no timestamp or worker allocation. It works well when IDs must be created independently and chronological locality isn't required. CSPRNG quality is the main dependency. [§5.4][rfc-v4], [§6.9][rfc-random]
- **v7:** the first 48 bits encode Unix milliseconds. The remaining 74 non-format bits can be random or include an optional sub-millisecond fraction and carefully seeded counter. The format therefore doesn't promise one universal same-millisecond ordering, entropy budget, restart behavior, or rollback policy. RFC §6.2 describes methods for monotonic generation, including keeping the previous timestamp during rollback or advancing logical time on overflow. [§5.7][rfc-v7], [§6.1][rfc-clock], [§6.2][rfc-monotonic]
- **v1:** uses 100-nanosecond intervals since 1582-10-15, a clock sequence, and a node field. If time moves backward and prior timestamps may have been used, the clock sequence must change. A MAC address isn't required: randomized node values are supported. The timestamp's low bits come first, so ordinary byte sorting isn't chronological across timestamp-field rollover. [§5.1][rfc-v1], [§6.10][rfc-node]
- **v6:** rearranges v1's timestamp from most to least significant bits for sorting. The RFC recommends resetting clock-sequence and node bits to pseudorandom values for each new v6, while permitting legacy v1 behavior. It recommends v7 for systems without a legacy v1 requirement. Thus “v6 always embeds a MAC” is incorrect. [§5.6][rfc-v6]

An implementation example shows why the distinction matters: PostgreSQL 18's `uuidv7()` combines millisecond time, sub-millisecond time, and randomness. Its documentation also says an extracted UUID timestamp need not exactly equal generation time. This is more specific than just “RFC-compliant v7,” and still isn't a cross-session commit-order guarantee. [PostgreSQL UUID functions][pg-uuid-functions]

## 5. Snowflake: local generation, managed worker identity

Twitter's archived `snowflake-2010` implementation documents this positive 64-bit layout:

```text
unused sign bit | 41-bit elapsed milliseconds | 10-bit machine identity | 12-bit sequence
```

The source splits machine identity into **5 datacenter bits and 5 worker bits**. Its epoch is `1288834974657` Unix milliseconds. The layout provides 1,024 datacenter/worker combinations, 4,096 sequence values per worker per millisecond, and about 69 years of timestamp space. These are format capacities, not measured throughput guarantees. [Original README][snow-readme], [IdWorker.scala][snow-worker]

`nextId()` is synchronized. Within the same millisecond it increments the sequence; when the 12-bit sequence wraps it waits for a later millisecond. If the clock is below the last timestamp, it throws `InvalidSystemClock`. The remembered timestamp is in memory. This behavior is specific to this implementation; other “Snowflake” libraries can choose different bit budgets or rollback handling. [IdWorker.scala][snow-worker]

Worker allocation remains essential. The original server takes configured IDs and claims its worker ID through a ZooKeeper **ephemeral node**, checks peers, and waits during startup. “Uncoordinated” describes ordinary generation, not the absence of identity management. [SnowflakeServer.scala][snow-server]

For a general Snowflake deployment, the correctness conditions are: don't let two generators use the same machine identity over overlapping timestamp/counter space; don't reuse previous timestamp/counter pairs after restart; and don't wrap the timestamp field. A random choice from 1,024 slots doesn't guarantee allocation uniqueness. A lease-based allocator must prevent a stale owner from generating after reassignment; a restarted worker may need persisted high-water state or a safe wait before reusing its identity. These are design requirements inferred from the bit layout, not guarantees proven for the archived server's full lifecycle.

The original README explicitly promises **rough time ordering**, discussing a one-second bound as its target guarantee. Clock skew and worker bits determine cross-worker order; the ID alone cannot enforce that bound. The archived code is evidence for the original design, not evidence of Twitter/X's current production implementation. [Original README][snow-readme]

## 6. ULID and random string IDs

**ULID** has a 48-bit millisecond timestamp followed by 80 random bits. Its canonical 26-character Crockford Base32 form sorts by timestamp with the specified ASCII ordering. Plain ULID generation doesn't guarantee sort order within one millisecond. The monotonic variant increments the random field and fails if that field overflows. [ULID spec][ulid-spec]

In the project's JavaScript implementation, `monotonicFactory()` closes over `lastTime` and `lastRandom`. When time is equal to or below `lastTime`, it retains that timestamp and increments the suffix. This establishes increasing IDs **within that surviving factory instance**, not between tabs, processes, devices, or a fresh factory after restart. Different factories can still collide probabilistically; their incrementing ranges aren't independent random draws. Adjacent suffixes from one factory are also predictable. [Pinned implementation][ulid-js]

**Nano ID** defaults to 21 characters from `A-Za-z0-9_-`, giving 126 random bits. For a uniform alphabet with `A` distinct symbols and length `L`, the space is `A^L` and the random-bit equivalent is `L × log2(A)`. Changing either parameter changes the risk. The secure implementation uses platform cryptographic randomness and rejection sampling for non-power-of-two alphabets to avoid modulo bias; `nanoid/non-secure` and custom random sources have different properties. [Docs][nanoid-doc], [source][nanoid-source]

Encoding affects correctness too. Nano ID's alphabet distinguishes case, so case-folding storage would collapse distinct IDs. ULID accepts case-insensitive text, but normalize its representation before relying on ASCII lexical sorting. These are consequences of the documented alphabets and sorting rules. [Nano ID][nanoid-doc], [ULID][ulid-spec]

## 7. Deterministic identity

**UUIDv5** hashes the namespace UUID and canonical name with SHA-1, truncates the result, and sets version/variant bits. The same namespace and canonical bytes must produce the same UUID. That helps independent producers agree on an identity, but it doesn't discover whether two differently written names refer to the same real entity. Define case, Unicode, separators, and tenant scope explicitly. Distinct inputs are expected to differ with high probability, not mathematical certainty. SHA-256-based name UUIDs belong in v8, not v5. [RFC §5.5][rfc-v5], [§6.5][rfc-names]

Don't derive a permanent entity key from a field that can change without planning the consequences. RFC 9562 specifically cautions against name-based natural primary keys for this reason. [§6.13][rfc-database]

**Content addressing** identifies an encoded content version. IPFS CIDs combine hash and format information; with the same content and settings, independent nodes derive the same CID. Different chunking, codecs, or DAG layouts can give the same file different CIDs. This is useful for deduplication and content verification, but a mutable entity usually needs a separate stable identity. Hash collision resistance is still an assumption. [IPFS content addressing][ipfs]

## 8. Sorting is not causality or commit order

Keep four contracts separate:

1. **Value order:** distinct IDs can be compared to obtain a deterministic total order, even when random. That says nothing about when events happened.
2. **Timestamp order:** v7, ULID, and Snowflake place time near the front. Skew, rollback policy, and equal timestamps limit how this relates to actual creation order. [RFC timestamp considerations][rfc-clock], [Snowflake README][snow-readme]
3. **Causal order:** if B reacts to a message from A, A happened before B. Independent wall-clock generators can still give B a smaller ID when B's clock is behind. This counterexample follows directly from their local timestamp inputs; choose a protocol that propagates logical-clock/dependency information when causality matters.
4. **Commit order:** allocating an ID before a write doesn't determine when that write commits. Database sequences have this limitation too, as the transaction example in §3 shows.

For comparison, etcd v3.6 explicitly gives its KV operations a total order consistent with real time, backed by consensus, and assigns each modifying operation an increasing revision. Several key changes in one transaction share that revision, so it isn't a unique ID for each changed row. This is a service-level ordering contract, not a property obtained from choosing a timestamp-prefixed ID. [etcd guarantees][etcd]

Practical consequence: `id > lastSeenId` over independently generated IDs isn't by itself a lossless synchronization cursor. A late-arriving offline write can have a smaller ID. Use the storage or synchronization protocol's change position and resume guarantees; etcd's watch revisions are one concrete example. [etcd watch guarantees][etcd]

## 9. Database storage and indexing

**Size:** a 64-bit integer is 8 payload bytes; a UUID or binary ULID is 16. Canonical UUID text is 36 ASCII characters, ULID text 26, and default Nano ID text 21. Text length isn't the same as physical row/index size. RFC 9562 recommends binary UUID storage where feasible; PostgreSQL has a native `uuid` type. [RFC §6.13][rfc-database], [PostgreSQL UUID type][pg-uuid], [ULID][ulid-spec], [Nano ID][nanoid-doc]

**Locality:** RFC 9562 explains that time-ordered UUIDs keep nearby inserts close in B-tree indexes, unlike randomly distributed v4 values. Npgsql likewise recommends its v7 generation for index behavior. This supports a workload-dependent expectation, not a universal performance multiplier. [RFC §6.11][rfc-sorting], [Npgsql][hilo]

**MySQL-specific amplification:** InnoDB stores rows in the clustered index, normally the primary key, and includes primary-key columns in every secondary-index record. Wider primary keys therefore increase secondary-index space. Don't project this exact storage layout onto every database engine. [MySQL 8.4 InnoDB docs][mysql]

**Distributed range hotspots:** Spanner warns that monotonically increasing leading keys funnel writes into the same key range/server and recommends UUIDv4, bit-reversed sequences, or a distributing prefix for relevant workloads. A time-prefixed UUID can improve local index behavior yet be a poor unsharded leading key in such a system; that conclusion follows from Spanner's partitioning rule. Inspect secondary indexes too: their leading timestamps can recreate the hotspot. [Spanner schema design][spanner]

Recommendation: benchmark the actual storage engine, key encoding, index set, write rate, cache size, and partitioning scheme. “UUIDs are slow” and “v7 is always faster” omit the conditions that decide the result.

## 10. Multi-region, offline, and failure behavior

| Concern                        | What needs to hold                                                                                                                                                                                                                                                                           |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Offline or independent regions | v4, v7, ULID, and Nano ID can generate locally with an adequate random source. Timestamp-based variants don't guarantee accurate cross-region order. Ranges last until exhausted; Snowflake needs safely assigned identities. [RFC][rfc-distributed], [HiLo][hilo], [Snowflake][snow-server] |
| Entropy and cloning            | Preserve independent CSPRNG state across forks, restored snapshots, and runtimes. Cloned state can invalidate the independent-random-draw model. The RFC explicitly calls out forks; snapshot handling must be checked in the chosen runtime. [RFC §6.9][rfc-random]                         |
| Clock rollback or freeze       | v4/Nano ID uniqueness doesn't use a clock. Original Snowflake rejects backward time and waits on counter exhaustion. Stateful v7/ULID behavior depends on the generator. [Snowflake][snow-worker], [RFC §6.2][rfc-monotonic], [ULID JS][ulid-js]                                             |
| Restart and failover           | Recover sequence/range high-water marks and prevent old allocators from continuing after replacement. Monotonic in-memory state doesn't survive restart automatically. [PostgreSQL][pg-replication], [RFC §6.3][rfc-state], [ULID JS][ulid-js]                                               |
| Representation                 | Preserve all bits and the intended equality/comparison rules through APIs, storage, and clients. Collation or numeric rounding can turn distinct generated values into equal stored values. [RFC §4][rfc-format], [ECMAScript][js-safe]                                                      |

### JavaScript and 64-bit IDs

`Number.MAX_SAFE_INTEGER` is `2^53 - 1`, or `9007199254740991`. Larger integers can round to the same `number`. Snowflake and unrestricted database `bigint` IDs therefore need a lossless representation such as `bigint`, bytes, or decimal strings. Converting a rounded `number` to `bigint` afterward cannot recover the lost bits. Also, Number bitwise shifts operate on 32-bit values, so translating a 64-bit Snowflake formula directly with Number `<<` is incorrect. [ECMAScript safe integers][js-safe], [Number left shift][js-shift]

Use decimal strings in ordinary JSON APIs when interoperability matters. Default `JSON.stringify` throws for a BigInt unless customization converts it; encoding a large value as an ordinary JSON number risks precision loss in consumers. Decimal strings also need numeric comparison or fixed-width encoding if their sort order must match integer order. [ECMAScript JSON serialization][js-json]

### Predictability and authorization

Sequences and Snowflake expose structure; timestamp-based IDs reveal a time component, and monotonic suffixes can expose adjacent values. Secure random v4/Nano ID reduce guessability, but knowing an object's ID must not bypass authorization. RFC 9562 explicitly says UUIDs must not be treated as capabilities whose mere possession grants access. Use a separate, deliberately designed secret token when possession is meant to authorize an action. [RFC §8][rfc-security], [Nano ID security][nanoid-doc]

## 11. Practical choice guide

These are recommendations derived from the properties above:

- **One authoritative database, no client-side/offline creation requirement:** start with a sequence/identity integer. Use HiLo if preallocating keys removes material coordination or round-trip costs.
- **Independent or offline entity creation:** start with UUIDv4 for clock-independent generation. Choose UUIDv7 when timestamp locality is useful and the database's partitioning scheme supports it; verify the actual generator's rollback and monotonicity behavior.
- **Compact URL-safe random strings:** default Nano ID is a reasonable option when UUID interoperability isn't required. Recalculate risk before reducing its length or alphabet.
- **26-character time-sortable text:** ULID fits, with monotonicity scoped to one factory. Prefer v7 when standard UUID tooling and database types matter more than text length.
- **Compact 64-bit distributed IDs:** Snowflake-style generation fits a controlled server fleet that can manage worker ownership and clocks. It adds operational responsibilities that random IDs avoid.
- **Same semantic input must produce the same ID:** use namespace-based deterministic identity such as v5, with explicit canonicalization and SHA-1 suitability checked. Use content addresses for immutable content versions.
- **Strict global operation order, causal dependencies, or a reliable sync cursor:** choose the corresponding coordination/sync protocol separately from the entity ID format.

## 12. What remains implementation-specific

- This research doesn't establish one universal v7 monotonicity or entropy guarantee. RFC 9562 allows several constructions, and library options/version changes can matter.
- The ULID factory behavior is verified against the pinned JavaScript source below, not every ULID port. The Snowflake source is historical; full ZooKeeper session-expiration and restart safety wasn't verified end to end.
- Collision estimates assume independent uniform randomness. They don't quantify faulty entropy sources, state cloning, adversarial inputs, or monotonic range overlap.
- Database evidence establishes mechanisms and vendor recommendations. No workload-specific performance measurements were made, and there's no universal winner across B-trees and distributed key-range storage.

## Primary sources

RFC links throughout point to exact sections. Source-code links are pinned where implementation details matter; vendor documentation is versioned where available.

- [RFC 9562, UUIDs, May 2024][rfc]. Layouts, entropy, clocks, uniqueness scope, sorting, storage, and security.
- [PostgreSQL 18 sequence functions][pg-sequence], [sequence creation/cache behavior][pg-create-sequence], [logical-replication restrictions][pg-replication], [UUID functions][pg-uuid-functions].
- [Npgsql value generation][hilo]. Concrete HiLo strategy and client-generated v7 guidance.
- Twitter archive, revision `b3f6a3c6ca8e1b6847baa6ff42bf72201e2c2231`: [README][snow-readme], [IdWorker][snow-worker], [SnowflakeServer][snow-server].
- [ULID specification][ulid-spec], revision `d0c7170df4517939e70129b4d6462cc162f2d5bf`; [JavaScript implementation][ulid-js], revision `11c2067821ee19e4dc787ca4e0125a025485edc6`.
- Nano ID revision `bb68abcd59ebb86a849d634320726add6be54d47`: [README][nanoid-doc], [implementation][nanoid-source].
- [MySQL 8.4 InnoDB indexes][mysql], [Spanner schema design][spanner], [etcd v3.6 API guarantees][etcd], [IPFS CIDs][ipfs], and [ECMAScript safe integers][js-safe].

[rfc]: https://www.rfc-editor.org/rfc/rfc9562.html
[rfc-format]: https://www.rfc-editor.org/rfc/rfc9562.html#section-4
[rfc-v1]: https://www.rfc-editor.org/rfc/rfc9562.html#section-5.1
[rfc-v4]: https://www.rfc-editor.org/rfc/rfc9562.html#section-5.4
[rfc-v5]: https://www.rfc-editor.org/rfc/rfc9562.html#section-5.5
[rfc-v6]: https://www.rfc-editor.org/rfc/rfc9562.html#section-5.6
[rfc-v7]: https://www.rfc-editor.org/rfc/rfc9562.html#section-5.7
[rfc-clock]: https://www.rfc-editor.org/rfc/rfc9562.html#section-6.1
[rfc-monotonic]: https://www.rfc-editor.org/rfc/rfc9562.html#section-6.2
[rfc-state]: https://www.rfc-editor.org/rfc/rfc9562.html#section-6.3
[rfc-distributed]: https://www.rfc-editor.org/rfc/rfc9562.html#section-6.4
[rfc-names]: https://www.rfc-editor.org/rfc/rfc9562.html#section-6.5
[rfc-uniqueness]: https://www.rfc-editor.org/rfc/rfc9562.html#section-6.8
[rfc-random]: https://www.rfc-editor.org/rfc/rfc9562.html#section-6.9
[rfc-node]: https://www.rfc-editor.org/rfc/rfc9562.html#section-6.10
[rfc-sorting]: https://www.rfc-editor.org/rfc/rfc9562.html#section-6.11
[rfc-database]: https://www.rfc-editor.org/rfc/rfc9562.html#section-6.13
[rfc-security]: https://www.rfc-editor.org/rfc/rfc9562.html#section-8
[pg-sequence]: https://www.postgresql.org/docs/18/functions-sequence.html
[pg-create-sequence]: https://www.postgresql.org/docs/18/sql-createsequence.html
[pg-replication]: https://www.postgresql.org/docs/18/logical-replication-restrictions.html
[pg-uuid]: https://www.postgresql.org/docs/18/datatype-uuid.html
[pg-uuid-functions]: https://www.postgresql.org/docs/18/functions-uuid.html
[hilo]: https://www.npgsql.org/efcore/modeling/generated-properties.html#hilo-autoincrement-generation
[snow-readme]: https://github.com/twitter-archive/snowflake/blob/b3f6a3c6ca8e1b6847baa6ff42bf72201e2c2231/README.mkd
[snow-worker]: https://github.com/twitter-archive/snowflake/blob/b3f6a3c6ca8e1b6847baa6ff42bf72201e2c2231/src/main/scala/com/twitter/service/snowflake/IdWorker.scala
[snow-server]: https://github.com/twitter-archive/snowflake/blob/b3f6a3c6ca8e1b6847baa6ff42bf72201e2c2231/src/main/scala/com/twitter/service/snowflake/SnowflakeServer.scala
[ulid-spec]: https://github.com/ulid/spec/blob/d0c7170df4517939e70129b4d6462cc162f2d5bf/README.md
[ulid-js]: https://github.com/ulid/javascript/blob/11c2067821ee19e4dc787ca4e0125a025485edc6/source/ulid.ts
[nanoid-doc]: https://github.com/ai/nanoid/blob/bb68abcd59ebb86a849d634320726add6be54d47/README.md
[nanoid-source]: https://github.com/ai/nanoid/blob/bb68abcd59ebb86a849d634320726add6be54d47/index.js
[mysql]: https://dev.mysql.com/doc/refman/8.4/en/innodb-index-types.html
[spanner]: https://cloud.google.com/spanner/docs/schema-design#primary-key-prevent-hotspots
[etcd]: https://etcd.io/docs/v3.6/learning/api_guarantees/
[ipfs]: https://docs.ipfs.tech/concepts/content-addressing/
[js-safe]: https://tc39.es/ecma262/multipage/numbers-and-dates.html#sec-number.max_safe_integer
[js-shift]: https://tc39.es/ecma262/multipage/ecmascript-data-types-and-values.html#sec-numeric-types-number-leftShift
[js-json]: https://tc39.es/ecma262/multipage/structured-data.html#sec-serializejsonproperty
