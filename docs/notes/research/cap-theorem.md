# The CAP theorem: what Brewer conjectured, what Gilbert and Lynch proved, what it does not say, and where `@goodstate` sits

Researched **2026-11-21**. Every claim below was read in the paper, slide deck, vendor page or source file that owns it. Where the only reachable copy was a course or author mirror of the published text, the table says so. Mirrors are reproductions, not secondary sources. The few secondary sources are flagged where they are used.

**Papers and talks** (full text read unless noted; page numbers are those of the copy read, and published page numbers where the copy carries them):

| Topic                           | Source                                                                                                                                                                         | Copy read                                                                                                                                                                                  |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| CAP principle, harvest/yield    | Fox & Brewer, "Harvest, Yield, and Scalable Tolerant Systems", HotOS VII, 1999, pp. 174–178, doi:10.1109/HOTOS.1999.798396                                                     | [CMU course copy][fb99] (Ghostscript PDF from 2002, pages 1–5 unnumbered; the author's RAD Lab URL served HTML, not the PDF)                                                               |
| CAP conjecture                  | Brewer, "Towards Robust Distributed Systems", PODC 2000 keynote, 19 July 2000                                                                                                  | [slides on the author's Berkeley site][podc00] (12 PDF pages, 4 slides each; `www.cs.berkeley.edu/~brewer/PODC2000.pdf`, the URL Brewer 2012 cites, serves the byte-identical file)        |
| CAP proof                       | Gilbert & Lynch, "Brewer's Conjecture and the Feasibility of Consistent, Available, Partition-Tolerant Web Services", SIGACT News 33(2):51–59, 2002, doi:10.1145/564585.564601 | [course-hosted scan of the published issue][gl02] for page numbers; [MIT author copy `Brewer6.ps`][gl02-mit] for clean text; an [earlier draft on the NUS site][gl02-draft] differs (§2.5) |
| CAP revisited                   | Brewer, "CAP Twelve Years Later: How the 'Rules' Have Changed", IEEE Computer 45(2):23–29, 2012, doi:10.1109/MC.2012.37                                                        | [course-hosted publisher PDF][brewer12]                                                                                                                                                    |
| CAP as safety vs liveness       | Gilbert & Lynch, "Perspectives on the CAP Theorem", IEEE Computer 45(2):30–36, 2012, doi:10.1109/MC.2011.389                                                                   | [author preprint, MIT TDS, dated Dec 2011][gl12] (preprint pages 1–10, not the IEEE pages)                                                                                                 |
| PACELC                          | Abadi, "Consistency Tradeoffs in Modern Distributed Database System Design", IEEE Computer 45(2):37–42, 2012, doi:10.1109/MC.2012.33                                           | [publisher-typeset copy on author site][abadi12]                                                                                                                                           |
| CAP critique, delay-sensitivity | Kleppmann, "A Critique of the CAP Theorem", arXiv:1509.05393v2, 18 Sep 2015 (not peer-reviewed)                                                                                | [arXiv v2][kleppmann15]                                                                                                                                                                    |
| CAC theorem                     | Mahajan, Alvisi, Dahlin, "Consistency, Availability, and Convergence", UTCS TR-11-22, 2011                                                                                     | [author site][cac11] (TR page numbers)                                                                                                                                                     |
| HATs                            | Bailis, Davidson, Fekete, Ghodsi, Hellerstein, Stoica, PVLDB 7(3):181–192, 2013, doi:10.14778/2732232.2732237                                                                  | [VLDB][hat13]                                                                                                                                                                              |
| OCC bound                       | Attiya, Ellen, Morrison, "Limitations of Highly-Available Eventually-Consistent Data Stores", PODC 2015, doi:10.1145/2767386.2767419                                           | [authors' version][aem15] (abstract and introduction only)                                                                                                                                 |
| FLP                             | Fischer, Lynch, Paterson, "Impossibility of Distributed Consensus with One Faulty Process", JACM 32(2):374–382, 1985                                                           | [scan on the MIT TDS site][flp85] (abstract and §1 only)                                                                                                                                   |
| Spanner and CAP                 | Brewer, "Spanner, TrueTime & The CAP Theorem", Google, 14 Feb 2017                                                                                                             | [Google Research PDF][spanner17]                                                                                                                                                           |

**Vendor documentation**, fetched 2026-11-21: Apache Cassandra 5.0 docs source at [`cassandra-5.0@3e3892ce`][cass-guarantees] (`guarantees.adoc`, `dynamo.adoc`); Amazon DynamoDB [global tables][ddb-global]; CockroachDB [FAQ][crdb-faq] (v26.4, `dateModified` 2026-11-12); YugabyteDB [design goals][yb] (`/preview/` docs, modified 2026-11-03); FoundationDB [CAP Theorem][fdb] (8.0.1 docs, "Last updated on Nov 17, 2026"); MongoDB [elections][mongo-el] and [rollbacks][mongo-rb] (`/docs/manual/`, no version shown); Azure Cosmos DB [consistency levels][cosmos] (`updated_at` 2026-04-27); Google Cloud Spanner [TrueTime and external consistency][spanner-tt] ("Last updated 2026-11-12 UTC"); HashiCorp Consul [consistency modes][consul].

**This repository** at `02ee4f2` (2026-11-21), the commit after `e76db28` "Advance hlc on newer remote". One runtime probe of `@goodstate/time` was run (§6.6); nothing else was executed.

Companions in this directory: [Consistency models](consistency-models.md) (definitions of every model named here, the availability classes, and `@goodstate`'s session guarantees), [Replication topologies](replication-topologies.md) (who accepts writes and what a partition does to each arrangement), [Hybrid Logical Clocks](hybrid-logical-clocks.md) and [Local-first web architecture](local-first-architecture.md). This note does not repeat their definitions; it covers CAP itself.

---

## Short answer

**What was conjectured.** Fox and Brewer stated a "Strong CAP Principle" in 1999: "Strong Consistency, High Availability, Partition-resilience: Pick at most 2." Their consistency was "single-copy ACID", and their availability was weak: data "is considered highly available if a given consumer of the data can always reach some replica". [Fox & Brewer §2][fb99] Brewer's PODC 2000 slide calls it a theorem without a proof: "You can have at most two of these properties for any shared-data system". [PODC slides p. 4][podc00]

**What was proved.** Gilbert and Lynch turned it into a statement about one read/write register. Consistency is atomic (linearizable), availability is "every request received by a non-failing node in the system must result in a response", and partitions are a network that may "lose arbitrarily many messages". Theorem 1: in the asynchronous model no algorithm guarantees availability and atomic consistency "in all fair executions (including those in which messages are lost)". Corollary 1.1 is stronger: you cannot even guarantee atomicity only in executions where nothing is lost, because a node cannot tell a lost message from a slow one. With clocks and a known delivery bound (partial synchrony), Theorem 2 still forbids the combination under loss, but the corollary fails: a timeout-based algorithm can be atomic whenever no message is lost and return bounded-stale data otherwise. [G&L §2–4, pp. 52–58][gl02]

**What it does not say.** CAP is not "pick two of three": partitions are part of the network model, not a feature you opt out of, and "the '2 of 3' formulation was always misleading". [Brewer 2012 p. 23][brewer12] Its availability is a liveness property with no time bound, not uptime or an SLA. [G&L 2012 §3.1][gl12] [Kleppmann §2.1.2][kleppmann15] It says nothing about latency when there is no partition, which is the trade-off Abadi's PACELC adds. [Abadi p. 41][abadi12] It is about one linearizable register; other unavailability results (serializability, lost-update prevention) are separate proofs. [HAT §1, §5.2][hat13] CAP is related to FLP, but neither implies the other. [G&L 2012 §3.2, fn. 2][gl12]

**What is achievable while available.** Nothing stronger than real-time causal consistency in an always-available, one-way convergent store [CAC Thm 3.1][cac11]; read committed, monotonic atomic view and most session guarantees as highly available transactions, plus read-your-writes, PRAM and causal with sticky clients [HAT §5.3][hat13]. [Consistency models](consistency-models.md) §3 draws that boundary.

**How vendors classify themselves.** CockroachDB, YugabyteDB and FoundationDB call themselves CP and stress that "highly available" is a different property from CAP's A. Cassandra calls itself AP. Brewer calls Spanner "technically a CP system" that can claim to be "effectively CA". DynamoDB and MongoDB do not use CAP vocabulary on the pages read; their documented partition behaviour places MRSC global tables and majority-acknowledged MongoDB writes on the CP side, MREC global tables on the AP side. Cosmos DB frames its levels with PACELC (§5).

**Where `@goodstate` sits.** Every `query` and `mutate` completes against the tab's in-memory replica without waiting for any message [`store.ts:53–83`][nn-store], so the store meets Gilbert and Lynch's availability even with every message lost: it is AP, and in PACELC terms PA/EL. It therefore cannot be linearizable. Within AP, `e76db28` added the HLC receive rule [`global-time.ts:42–50`][nn-global-time] [`lww-register.ts:68–76`][nn-register], which restores writes-follow-reads in the arbitration sense that [Consistency models](consistency-models.md) §6.4 found missing. Causal visibility across roots, atomic multi-root visibility, list order and the replacing server still keep the store below causal+, the ceiling for a last-writer-wins store (§6.4). The receive rule also opened a liveness hole: a remote time ahead of the wall clock with a saturated counter makes the next local `Time.now()` throw (§6.6, probed).

---

## 1. Origin: Fox & Brewer 1999 and the PODC 2000 keynote

### 1.1 Fox & Brewer, "Harvest, Yield, and Scalable Tolerant Systems" (HotOS 1999)

The paper names the principle in §2, "Related Work and the CAP Principle", and defines its three letters there [Fox & Brewer §2, copy p. 1][fb99]:

- **C**: "strong consistency means single-copy ACID [13] consistency; by assumption a strongly-consistent system provides the ability to perform updates, otherwise discussing consistency is irrelevant."
- **A**: "High availability is assumed to be provided through redundancy, e.g. data replication; data is considered highly available if a given consumer of the data can always reach some replica."
- **P**: "Partition-resilience means that the system as whole can survive a partition between data replicas."

> "Strong CAP Principle. Strong Consistency, High Availability, Partition-resilience: Pick at most 2." [§2, copy p. 1][fb99]

The "proof" offered is "by exhaustive example": "CA without P: Databases that provide distributed transactional semantics can only do so in the absence of a network partition separating server peers"; "CP without A: In the event of a partition, further transactions to an ACID database may be blocked until the partition heals"; "AP without C: HTTP Web caching provides client-server partition resilience by replicating documents". It then generalizes: "any distributed database problem can be solved with either expiration-based caching to get AP, or replicas and majority voting to get PC (the minority is unavailable)." [§2, copy p. 1][fb99]

The paper also states a **Weak CAP Principle** it does not formalize: "The stronger the guarantees made about any two of strong consistency, high availability, or resilience to partitions, the weaker the guarantees that can be made about the third." [§2, copy p. 2][fb99] It closes by calling a formal framework for degraded results a future "constructive proof of the Weak CAP Principle". [§6, copy p. 4][fb99]

The rest of the paper is about **graceful degradation**, measured by two metrics: "yield, which is the probability of completing a request, and harvest, which measures the fraction of the data reflected in the response". [§3, copy p. 2][fb99] It adds: "Nearly all systems are probabilistic whether they realize it or not." [§4, copy p. 2][fb99]

Three things to note against the later theorem:

1. C here is **one-copy serializability of transactions**, not linearizability of a register. Kleppmann: "Fox and Brewer [24] define the C in CAP as one-copy serializability (1SR) [15], whereas Gilbert and Lynch [25] define it as linearizability." [Kleppmann §2.2.1, p. 3][kleppmann15]
2. A here is **reachability of some replica**, which a majority-quorum system can satisfy. Gilbert and Lynch's A is stricter (§2.2).
3. "CA without P" was listed as a real option. Brewer later withdrew it (§4.2).

### 1.2 Brewer's PODC 2000 keynote, "Towards Robust Distributed Systems"

The slides set CAP inside an argument that "Classic DS focus on the computation, not the data – this is WRONG" and that ACID versus BASE is a "fundamental" trade-off: "we forfeit 'C' and 'I' for availability, graceful degradation, and performance". BASE is "Basically Available, Soft-state, Eventual consistency". [PODC slides p. 3][podc00]

The CAP slide lists "Consistency", "Availability" and "Tolerance to network Partitions" around a triangle, with the claim:

> "Theorem: You can have at most two of these properties for any shared-data system" [PODC slides p. 4, "The CAP Theorem"][podc00]

No letter is defined beyond its name. The next three slides give examples and traits [PODC slides pp. 4–5][podc00]:

| Slide                | Examples                                                       | Traits                                                      |
| -------------------- | -------------------------------------------------------------- | ----------------------------------------------------------- |
| Forfeit Partitions   | single-site databases, cluster databases, LDAP, xFS            | 2-phase commit, cache validation protocols                  |
| Forfeit Availability | distributed databases, distributed locking, majority protocols | pessimistic locking, "Make minority partitions unavailable" |
| Forfeit Consistency  | Coda, web caching, DNS                                         | expirations/leases, conflict resolution, optimistic         |

"CAP Take Homes" includes two lines that matter for local-first: "Wide-area databases can't have both" and "Disconnected clients can't have both". The ACID/BASE slide already hedged the binary framing: "But I think it's a spectrum". [PODC slides pp. 4–5][podc00]

Brewer's own later dating: "The theorem first appeared in fall 1998. It was published in 1999 and in the keynote address at the 2000 Symposium on Principles of Distributed Computing, which led to its proof." [Brewer 2012 p. 24][brewer12]

---

## 2. The theorem: Gilbert & Lynch 2002

Gilbert and Lynch state their aim as discussing "what Brewer meant by the conjecture", then formalizing and proving it. [G&L §1, p. 51][gl02] Quotes below follow the MIT author copy; page numbers are those of the SIGACT News issue.

### 2.1 The three definitions

**Consistency: atomic data objects.**

> "The most natural way of formalizing the idea of a consistent service is as an atomic data object. Atomic [4], or linearizable [3], consistency is the condition expected by most web services today. Under this consistency guarantee, there must exist a total order on all operations such that each operation looks as if it were completed at a single instant. This is equivalent to requiring requests of the distributed shared memory to act as if they were executing on a single node, responding to operations one at a time." [§2.1, p. 52][gl02]

Footnote 3 separates it from ACID: "database consistency refers to transactions, while atomic consistency refers only to a property of a single request/response operation sequence. And it has a different meaning than the Atomic in ACID, as it subsumes the database notions of both Atomic and Consistent." [fn. 3, p. 52][gl02] For the definition of linearizability itself see [Consistency models](consistency-models.md) §2.1.

**Availability.**

> "For a distributed system to be continuously available, every request received by a non-failing node in the system must result in a response. That is, any algorithm used by the service must eventually terminate. In some ways this is a weak definition of availability: it puts no bound on how long the algorithm may run before terminating, and therefore allows unbounded computation. On the other hand, when qualified by the need for partition tolerance, this can be seen as a strong definition of availability: even when severe network failures occur, every request must terminate." [§2.2, p. 53][gl02]

Footnote 4 records the change from Brewer: "Brewer originally only required almost all requests to receive a response. As allowing probabilistic availability does not change the result when arbitrary failures occur, for simplicity we are requiring 100% availability." [fn. 4, p. 53][gl02]

**Partition tolerance.**

> "In order to model partition tolerance, the network will be allowed to lose arbitrarily many messages sent from one node to another. When a network is partitioned, all messages sent from nodes in one component of the partition to nodes in another component are lost. (And any pattern of message loss can be modeled as a temporary partition separating the communicating nodes at the exact instant the message is lost.)" [§2.3, p. 53][gl02]

P is not a third property of the algorithm. It qualifies the other two: "The above definitions of availability and atomicity are qualified by the need to tolerate partitions." Availability then means "every node receiving a request from a client must respond, even though arbitrary messages that are sent may be lost. Note that this is similar to wait-free termination in a pure shared-memory system: even if every other node in the network fails (i.e. the node is in its own unique component of the partition), a valid (atomic) response must be generated." [§2.3, p. 53][gl02] Footnote 5: "Brewer pointed out in the talk that partitions of one node are irrelevant: they are equivalent to that node failing." [fn. 5, p. 53][gl02]

Stopping failures are out of scope: "In this note we will not consider stopping failures, though in some cases a stopping failure can be modeled as a node existing in its own unique component of a partition." [§1, p. 52][gl02]

### 2.2 Theorem 1 and its proof (asynchronous model)

The model is Lynch's asynchronous network: "there is no clock, and nodes must make decisions based only on the messages received and local computation." [§3.1, p. 53][gl02]

> "**Theorem 1** It is impossible in the asynchronous network model to implement a read/write data object that guarantees the following properties: • Availability • Atomic consistency in all fair executions (including those in which messages are lost)." [§3.1, p. 53][gl02]

**Proof sketch.** Split the nodes into two non-empty sets G1 and G2 and lose every message between them. [§3.1, pp. 53–54][gl02]

```text
              G1                    ║  every G1↔G2 message is lost  ║              G2
α1:  write(v1) at G1 ── returns     ║                               ║
     (availability forces it)       ║                               ║
α2:                                 ║                               ║   read at G2 ── returns v0
                                    ║                               ║   (no write in α2; availability forces it)
α = α1 followed by α2:  G2 cannot distinguish α from α2, so the read still returns v0,
                        although it began after write(v1) completed.  → not atomic
```

"To the nodes in G2, α is indistinguishable from α2, as all the messages from G1 to G2 are lost … Therefore in the α execution, the read request (from α2) must still return v0. However the read request does not begin until after the write request (from α1) has completed. This therefore contradicts the atomicity property". [§3.1, p. 54][gl02]

### 2.3 Corollary 1.1: you cannot even be "consistent unless partitioned" without clocks

> "**Corollary 1.1** It is impossible in the asynchronous network model to implement a read/write data object that guarantees the following properties: • Availability, in all fair executions, • Atomic consistency, in fair executions in which no messages are lost." [§3.1, p. 54][gl02]

"The main idea is that in the asynchronous model an algorithm has no way of determining whether a message has been lost, or has been arbitrarily delayed in the transmission channel." The proof takes the non-atomic prefix of some execution from Theorem 1 and extends it into a fair execution in which every message is eventually delivered: still not atomic. [§3.1, p. 54][gl02]

This is the part of CAP that the "it only matters during partitions" reading misses (§4.4). Gilbert and Lynch restate it in 2012: "if communication is asynchronous … it is possible for the same situation to occur even in executions in which there are no messages lost, i.e., no actual partition! … Thus it is even impossible to guarantee consistency when there are no partitions, and return a bad (inconsistent) answer only when partitions occur." [G&L 2012 §2, p. 3][gl12]

### 2.4 Any two are achievable

"While it is impossible to provide all three properties: atomicity, availability, and partition tolerance, any two of these three properties can be achieved." [§3.2, p. 54][gl02]

- **Atomic, partition tolerant**: "The trivial system that ignores all requests meets these requirements." Better: a single designated node holds the value; others forward to it, so "if all the messages in an execution are delivered, the system is available and all operations terminate". [§3.2.1, p. 55][gl02]
- **Atomic, available**: "If there are no partitions, it is clearly possible to provide atomic, available data." [§3.2.2, p. 55][gl02]
- **Available, partition tolerant**: "If there are no consistency requirements, the service can trivially return v0, the initial value, in response to every request. However it is possible to provide weakened consistency in an available, partition tolerant setting. Web caches are one example". [§3.2.3, p. 55][gl02]

### 2.5 Partially synchronous model: Theorem 2, timeouts, and t-Connected Consistency

The second model gives every node a clock running at the same rate (but not synchronized) and assumes "every message is either delivered within a given, known time: t_msg, or it is lost", with processing time bounded by t_local. [§4.1, p. 55][gl02]

> "**Theorem 2** It is impossible in the partially synchronous network model to implement a read/write data object that guarantees the following properties: • Availability • Atomic consistency in all executions (even those in which messages are lost)." [§4.2, p. 56][gl02]

The proof prepends a long idle interval to the read so that the write completes first in real time; the read still returns v0. [§4.2, p. 56][gl02]

**The corollary does not carry over.** "In the partially synchronous model, however, the analogue of Corollary 1.1 does not hold. The proof of this corollary does in fact depend on nodes being unaware of when a message is lost." The centralized protocol with a timeout of 2·t_msg + t_local returns the central value when it hears back, and otherwise "either the best known value of the local node (for a read operation), or an acknowledgment (for a write operation). In this case, atomic consistency may be violated." [§4.3, p. 56][gl02]

**t-Connected Consistency** is the weaker condition the paper proposes for executions with loss:

> "**Definition 3** A timed execution, α, of a read-write object is t-Connected Consistent if two criteria hold. First, in executions in which no messages are lost, the execution is atomic. Second, in executions in which messages are lost, there exists a partial order P on the operations in α such that: 1. P orders all write operations, and orders all read operations with respect to the write operations. 2. The value returned by every read operation is exactly the one written by the previous write operation in P, or the initial value, if there is no such previous write in P. 3. The order in P is consistent with the order of read and write requests submitted at each node. 4. Assume there exists an interval of time longer than t in which no messages are lost. Further, assume an operation, θ, completes before the interval begins, and another operation, φ, begins after the interval ends. Then φ does not precede θ in the partial order P." [§4.4, p. 57][gl02]

"This guarantee allows for some stale data when messages are lost, but provides a time limit on how long it takes for consistency to return, once the partition heals." Theorem 4 shows a variant of the centralized algorithm (timeouts, retransmission to the central node, periodic broadcast of the latest value and sequence number) is t-Connected Consistent. [§4.4, pp. 57–59][gl02]

**The "Delayed-t" draft.** The file on Gilbert's NUS page named `BrewersConjecture-SigAct.pdf` (byte-identical to the copy on Princeton's COS 418 site) is an earlier draft. It calls the condition "Delayed-t Consistent", gives five criteria with an explicit "(Atomicity)" item 4 and a "(Weakly Consistent)" item 5, and relates it to "the idea of eventually consistent data … here, however, we want an explicit time bound". [NUS draft §4.4, Def. 3][gl02-draft] The published SIGACT News text and the MIT copy use "t-Connected Consistency" and the two-part definition above. Cite the published name.

**Conclusion of the paper:** "In an asynchronous model, when no clocks are available, the impossibility result is fairly strong: it is impossible to provide consistent data, even allowing stale data to be returned when messages are lost. However in partially synchronous models it is possible to achieve a practical compromise between consistency and availability. In particular, most real-world systems today are forced to settle with returning 'most of the data, most of the time.'" [§5, p. 59][gl02]

### 2.6 What exactly the theorem covers

| Aspect      | Gilbert & Lynch 2002                                                                                      |
| ----------- | --------------------------------------------------------------------------------------------------------- |
| Object      | One read/write register                                                                                   |
| C           | Atomic = linearizable, a safety property                                                                  |
| A           | Every request at a non-failing node eventually gets a response; no time bound; 100%, not "almost all"     |
| P           | The network may lose arbitrarily many messages; a model assumption, not a property the algorithm provides |
| Failures    | Message loss only; no crashes                                                                             |
| Models      | Asynchronous (Thm 1, Cor 1.1) and partially synchronous with known delivery bound (Thm 2)                 |
| Not covered | Transactions, multi-object invariants, latency, probabilistic availability, weaker consistency models     |

---

## 3. Later clarifications and critiques

### 3.1 Brewer, "CAP Twelve Years Later" (2012)

**The restatement.** "The CAP theorem states that any networked shared-data system can have at most two of three desirable properties: consistency (C) equivalent to having a single up-to-date copy of the data; high availability (A) of that data (for updates); and tolerance to network partitions (P)." Then: "The '2 of 3' formulation was always misleading because it tended to oversimplify the tensions among properties. Now such nuances matter. CAP prohibits only a tiny part of the design space: perfect availability and consistency in the presence of partitions, which are rare." [p. 23][brewer12]

**Why "2 of 3" misleads**, in three points [p. 24][brewer12]:

1. "because partitions are rare, there is little reason to forfeit C or A when the system is not partitioned."
2. "the choice between C and A can occur many times within the same system at very fine granularity; not only can subsystems make different choices, but the choice can change according to the operation or even the specific data or user involved."
3. "all three properties are more continuous than binary. Availability is obviously continuous from 0 to 100 percent, but there are also many levels of consistency, and even partitions have nuances, including disagreement within the system about whether a partition exists."

**CAP and latency.** "In its classic interpretation, the CAP theorem ignores latency, although in practice, latency and partitions are deeply related. Operationally, the essence of CAP takes place during a timeout, a period when the program must make a fundamental decision—the partition decision: cancel the operation and thus decrease availability, or proceed with the operation and thus risk inconsistency." "Retrying communication to achieve consistency, for example, via Paxos or a two-phase commit, just delays the decision. At some point the program must make the decision; retrying communication indefinitely is in essence choosing C over A." [p. 24][brewer12] "Thus, pragmatically, a partition is a time bound on communication." Consequences: "there is no global notion of a partition", and "systems with tighter bounds will likely enter partition mode more often and at times when the network is merely slow and not actually partitioned." [p. 25][brewer12]

**CAP versus ACID** (sidebar): "the C in CAP refers only to single‐copy consistency, a strict subset of ACID consistency." "Isolation is at the core of the CAP theorem: if the system requires ACID isolation, it can operate on at most one side during a partition. Serializability requires communication in general and thus fails across partitions." Atomicity and durability need not be forfeited. [p. 24, "ACID, BASE, and CAP"][brewer12]

**Disconnected operation** (sidebar): "If users cannot reach the service at all, there is no choice between C and A except when part of the service runs on the client. This exception, commonly known as disconnected operation or offline mode, is becoming increasingly important. Some HTML5 features—in particular, on-client persistent storage—make disconnected operation easier going forward. These systems normally choose A over C and thus must recover from long partitions." [p. 25, "CAP Confusion"][brewer12]

**Partition mode and recovery.** The proposed strategy has three steps: "detect the start of a partition, enter an explicit partition mode that may limit some operations, and initiate partition recovery when communication is restored." [pp. 25–26][brewer12] In partition mode a designer builds "a table that looks at the cross product of all operations and all invariants and decide[s] for each entry if that operation could violate the invariant. If so, the designer must decide whether to prohibit, delay, or modify the operation." [p. 26][brewer12] Recovery has "two hard problems": "the state on both sides must become consistent, and there must be compensation for the mistakes made during partition mode." [p. 27][brewer12] For history tracking Brewer recommends version vectors and cites CAC: "Recent work proved that this kind of causal consistency is the best possible outcome in general if the designer chooses to focus on availability." [p. 27][brewer12] (CAC's theorem is about real-time causal consistency; see §3.5.)

**CRDTs and compensation.** CRDTs are "a class of data structures that provably converge after a partition"; "by implementing state through CRDTs, a designer can choose A and still ensure that state converges automatically after a partition." [p. 27][brewer12] Their limit: "Technically, CRDTs allow only locally verifiable invariants—a limitation that makes compensation unnecessary but that somewhat decreases the approach's power." Fixes for invariants range from "trivial ways such as 'last writer wins' (which ignores some updates)" to merging and "human escalation". [p. 28][brewer12] The ATM sidebar is the worked example: "modern ATMs limit the net withdrawal to at most k", and "the banking system depends not on consistency for correctness, but rather on auditing and compensation." [p. 28][brewer12]

### 3.2 Gilbert & Lynch, "Perspectives on the CAP Theorem" (2012)

**CAP as a safety/liveness trade-off.** "Consistency (as defined in the CAP Theorem) is a classic safety property: every response sent to a client is correct." "Availability is a classic liveness property: eventually, every request receives a response." "The CAP Theorem, in this light, is simply one example of the fundamental fact that you cannot achieve both safety and liveness in an unreliable distributed system." [§1, p. 1][gl12] §3.1 restates it: "the CAP Theorem states that it is impossible for any protocol implementing an atomic read/write register to guarantee both safety and liveness in a system prone to partitions." [§3.1, p. 3][gl12]

**The theorem restated.** "In a network subject to communication failures, it is impossible for any web service to implement an atomic read/write shared memory that guarantees a response to every request." [§2, p. 3][gl12] Availability "simply means that each request eventually receive a response. Obviously, a fast response is better than a slow response, but for the purpose of CAP, it turns out that even requiring an eventual response is sufficient to create problems. (In most real systems, of course, a response that is sufficiently late is just as bad as a response that never occurs.)" [§2, p. 2][gl12] Partition tolerance "can be seen as a statement regarding the underlying system". [§2, p. 2][gl12]

**Scope.** The paper focuses on "simple services" with "a sequential specification" and atomic operations; "Complicated services" with transactional semantics are set aside: "The same CAP trade-offs typically apply, but for simplicity we do not focus on these cases." "Trivial services", which need no coordination, "do not fall within the scope of the CAP Theorem". [§2, p. 2][gl12]

**Third option: sacrifice both.** "Perhaps surprisingly, there is a third option: some systems may sacrifice both consistency and availability! In doing so they may achieve a trade-off better suited for the application at hand." [§1, p. 1][gl12] Examples: best-effort availability (Chubby, §4.1), best-effort consistency (Akamai-style caches, §4.2), tunable staleness that gives "neither strong consistency nor guaranteed availability" (TACT, §4.3), and segmenting by data, operation, function, user and hierarchy (§4.4). [§4, pp. 5–8][gl12]

### 3.3 FLP is a different impossibility

Gilbert and Lynch place CAP next to FLP and say neither implies the other. FLP "showed that fault-tolerant agreement is impossible in an asynchronous system". Consensus "is (provably) harder than simply implementing an atomic read/write register. This means that the CAP Theorem also implies that you cannot achieve consensus in a system subject to partitions." But: "In [15], Fischer et al. considered a system with no partitions. Instead, the focus on an even more benign failure model: crash failures." Footnote 2: "Notice that as a result, the CAP Theorem does not imply the results in [15]. Conversely, [15] does not immediately imply the CAP Theorem." [G&L 2012 §3.2, pp. 3–4, fn. 2][gl12]

FLP's own framing confirms the difference in fault model: "we show the surprising result that no completely asynchronous consensus protocol can tolerate even a single unannounced process death. We do not consider Byzantine failures, and we assume that the message system is reliable—it delivers all messages correctly and exactly once." [FLP §1, p. 375][flp85] Its abstract: "every protocol for this problem has the possibility of nontermination, even with only one faulty process." [FLP abstract, p. 374][flp85]

| Result   | Problem                 | Faults                                | Safety                        | Liveness                              | Conclusion                      |
| -------- | ----------------------- | ------------------------------------- | ----------------------------- | ------------------------------------- | ------------------------------- |
| FLP 1985 | Consensus               | One crash; messages reliable          | Agreement, validity           | Termination                           | Some execution never terminates |
| CAP 2002 | One read/write register | Arbitrary message loss; no crashes    | Atomicity                     | Every request answered                | Not both, in all executions     |
| CAC 2011 | Read/write storage      | Omission failures, unreliable network | Consistency stronger than RTC | Always available + one-way convergent | Not all three                   |

[G&L 2012 §3.3][gl12] then surveys the consensus literature's two escapes, which mirror CAP's: more synchrony (eventual synchrony, failure detectors, "f + 2 rounds" of synchrony) and weaker agreement (k-set agreement, "the 'most' agreement you can get in a system with k − 1 failures, if you want to ensure availability"). [§3.3.1–3.3.2, pp. 4–5][gl12]

### 3.4 Abadi, PACELC (2012)

Abadi's point is that CAP constrains failure behaviour only: "In reality, CAP only posits limitations in the face of certain types of failures, and does not constrain any system capabilities during normal operation." [p. 37][abadi12] "It is not merely the partition tolerance that necessitates a tradeoff between consistency and availability; rather, it is the combination of partition tolerance and the existence of a network partition itself." "CAP allows the system to make the complete set of ACID … guarantees alongside high availability when there are no partitions." [p. 38][abadi12]

The trade-off that is always present is consistency versus latency, because high availability requires replication: "As soon as a DDBS replicates data, a tradeoff between consistency and latency arises." [p. 39][abadi12] "This tradeoff exists even when there are no network partitions, and thus is completely separate from the tradeoffs CAP describes." [p. 38][abadi12] The formulation:

> "if there is a partition (P), how does the system trade off availability and consistency (A and C); else (E), when the system is running normally in the absence of partitions, how does the system trade off latency (L) and consistency (C)?" [p. 41][abadi12]

His classifications: default Dynamo, Cassandra and Riak are PA/EL; VoltDB/H-Store, Megastore, BigTable and HBase are PC/EC; MongoDB (2012) PA/EC; PNUTS PC/EL. On MongoDB he adds: "Technically, when a partition occurs, MongoDB is not available according to the CAP definition of availability, as the minority partition is not available." On PC/EL: "PC does not indicate that the system is fully consistent; rather it indicates that the system does not reduce consistency beyond the baseline consistency level when a network partition occurs". [p. 42][abadi12] He also notes that quorums with R + W > N still fall short of Gilbert and Lynch's consistency without "protocol additions". [p. 40][abadi12]

PACELC is a classification, not a theorem. The paper ends: "neither CAP nor PACELC can explain them all." [p. 42][abadi12]

### 3.5 Kleppmann, "A Critique of the CAP Theorem" (2015)

**Definitions disagree.** Availability in practice "refers to the proportion of time during which a service is able to successfully handle requests", measured against an SLA, and "it is nonsensical to say that some software package or algorithm is 'available' or 'unavailable' in general". [§2.1, p. 2][kleppmann15] Gilbert and Lynch's availability is a property of an algorithm, and "is at odds with Fox and Brewer's original proposal of CAP, which states that 'data is considered highly available if a given consumer of the data can always reach some replica'". Many leader-based systems "have very high uptime in practice, but are in fact 'unavailable' under Gilbert and Lynch's definition". [§2.1.1, p. 3][kleppmann15] It has no latency bound and "is a pure liveness property, not a safety property". [§2.1.2, p. 3][kleppmann15]

**Partition tolerance is a model assumption.** "we can interpret partition tolerance as meaning 'a network partition is among the faults that are assumed to be possible in the system.' … It is misleading to say that an algorithm 'provides partition tolerance,' and it is better to say that an algorithm 'assumes that partitions may occur.'" [§2.3.1, p. 4][kleppmann15]

**Problems with the proof's formalization.**

- Only non-failing nodes must respond, so "If it is possible for the algorithm to declare nodes as failed (e.g. if a node may crash itself), then the availability property can be trivially satisfied". [§3.1.1, p. 5][kleppmann15]
- With fair-loss links, partitions are finite, and a linearizable algorithm may wait them out without violating unbounded-time availability (ABD does this). "We can conclude that Theorem 1 is only valid in a system model where infinite partitions are possible." [§3.1.2, pp. 5–6][kleppmann15]
- With infinite partitions, eventual consistency is impossible too: "the results so far do not differentiate between linearizable and eventually consistent algorithms: both are possible if partitions are always finite, and both are impossible in a system model with infinite partitions." [§3.1.3, p. 6][kleppmann15]

His reformulation uses "opportunistic" properties that only need to hold in loss-free executions. Corollary 2: "There is no algorithm that implements a terminating read-write register in the partitionable model that is linearizable in all loss-free executions", whereas "opportunistic eventual consistency is possible. This distinction can be understood as the key result of CAP. However, it is arguably not a very interesting or insightful result." [§3.2.2–3.2.3, pp. 7–8][kleppmann15]

**Brewer's version is not a theorem.** "Brewer's informal interpretation of CAP is intuitively appealing, but it is not a theorem, since it is not expressed formally … – it is, at best, a rule of thumb. Gilbert and Lynch's formalization can be proved correct, but it does not correspond to practitioners' intuitions for real systems." [§3.3, p. 8][kleppmann15]

**Delay-sensitivity.** "we assert that availability should be modeled in terms of operation latency", with network faults modelled as large delays "provided that the duration of the partition is finite and lost packets are retransmitted". [§4.1, pp. 8–9][kleppmann15] Table 1 gives the lowest possible latency as a function of network delay d [Table 1, p. 9][kleppmann15]:

| Consistency level      | Write latency | Read latency |
| ---------------------- | ------------- | ------------ |
| Linearizability        | O(d)          | O(d)         |
| Sequential consistency | O(d)          | O(1)         |
| Causal consistency     | O(1)          | O(1)         |

The linearizability row rests on Attiya and Welch's u/2 bound, the sequential row on Lipton and Sandberg's |r| + |w| ≥ d; both are cited by Kleppmann and were not read for this note (§7). For causal: "causal consistency … with eventual convergence is the strongest possible consistency guarantee with this property", citing AEM and CAC. [§4.2, pp. 9–10][kleppmann15] Then: "a fully delay-independent system supports disconnected (offline) operation", with a mobile calendar as the example. [§4.4–4.5, pp. 10–11][kleppmann15] His recommendation: "CAP has now reached the end of its usefulness; we recommend that it should be relegated to the history of distributed systems, and no longer be used for justifying design decisions." [§5, p. 12][kleppmann15]

### 3.6 What can be achieved while available: CAC, HATs, OCC

These results answer the question CAP leaves open. Definitions are in [Consistency models](consistency-models.md) §2.3 and §3; only the CAP-relevant framing is here.

- **CAC (Mahajan, Alvisi, Dahlin).** "we close the gap between what is known to be impossible (i.e. CAP) and known systems that are highly-available but that provide weaker consistency such as causal." Availability: "all reads and writes can complete regardless of which messages are lost and which nodes can communicate." Convergence is added because without it "there exist many semantics that (1) are stronger than causal consistency, (2) are always available to reads and writes, and (3) 'feel' somehow 'artificial'". **Theorem 3.1**: "No consistency semantics stronger than real time causal consistency can be implemented using a one-way convergent and always available distributed storage implementation." [CAC abstract, §1, §2.2–2.3, §3.1, TR pp. 1–4][cac11] The bound is real-time causal (RTC), not plain causal: "Why isn't causal the strongest?" answers with an execution that is causal but not RTC. [§5, TR p. 9][cac11] Brewer's 2012 paraphrase ("this kind of causal consistency is the best possible outcome") compresses that.
- **HATs (Bailis et al.).** The introduction states the scope problem directly: "As formally proven [35], the CAP Theorem pertains to a data consistency model called linearizability … However, despite its narrow scope, the CAP Theorem is often misconstrued as a broad result regarding the ability to provide ACID database properties with high availability". [§1, p. 181][hat13] They adopt Gilbert and Lynch's availability and note its strictness: "systems that require a majority of servers to be online are not available. Similarly, a system which guarantees that servers provide a response with high probability is not available." [§4, fn. 2, p. 184][hat13] Preventing lost update "reduces to a requirement for linearizability, which is, via Gilbert and Lynch's proof of the CAP Theorem, provably at odds with high availability". [§5.2.1, p. 187][hat13] Summary: "With sticky availability, a system can achieve read your writes guarantees and PRAM and causal consistency. However, many other prominent semantics, such as Snapshot Isolation, One-Copy Serializability, and Strong Serializability cannot be achieved". [§5.3, p. 187; Table 3, p. 188][hat13]
- **OCC (Attiya, Ellen, Morrison).** For stores of multi-value registers: "An eventually consistent data store implementing MVRs cannot satisfy a consistency model strictly stronger than observable causal consistency (OCC)", under stated assumptions. [abstract][aem15] It does not bind a last-writer-wins store such as `@goodstate` ([Consistency models](consistency-models.md) §2.3).

---

## 4. Common misreadings, each against a primary source

### 4.1 "Pick 2 of 3"

The phrase is Fox and Brewer's ("Pick at most 2", [§2][fb99]). Its own author retracted it: "The '2 of 3' formulation was always misleading because it tended to oversimplify the tensions among properties." [Brewer 2012 p. 23][brewer12] In 2017: "Note that you are not entitled to 2 of 3, and many systems have zero or one of the properties." [Brewer 2017 p. 1][spanner17] Gilbert and Lynch: "some systems may sacrifice both consistency and availability!" [G&L 2012 §1][gl12] The theorem constrains only the combination of A and C under loss; P is part of the network model ([G&L 2002 §2.3][gl02]).

### 4.2 "CA systems" and "partition tolerance is optional"

The 1999 paper lists "CA without P" and the 2000 slide "Forfeit Partitions". [Fox & Brewer §2][fb99] [PODC slides p. 4][podc00] Gilbert and Lynch's §3.2.2 constructs "Atomic, Available" only "If there are no partitions". [G&L 2002 §3.2.2, p. 55][gl02] Brewer 2012 asks the question directly: "exactly what it means to forfeit P is unclear. Can a designer choose not to have partitions? If the choice is CA, and then there is a partition, the choice must revert to C or A. It is best to think about this probabilistically: choosing CA should mean that the probability of a partition is far less than that of other systemic failures". And: "although partitions are less likely within a datacenter, they are indeed possible, which makes a CA goal problematic." [p. 25, "CAP Confusion"][brewer12] Kleppmann: partition tolerance is a model assumption, not a property an algorithm "provides". [§2.3.1, p. 4][kleppmann15] FoundationDB's docs: "CA is not really a coherent option because a system that is not Partition-tolerant will, by definition, be forced to give up Consistency or Availability during a partition." [FoundationDB][fdb]

Spanner's "effectively CA" (§5) is the probabilistic reading made explicit: "technically a CP system", whose partitions are rare enough that users "can and do assume CA". [Brewer 2017 p. 1][spanner17]

### 4.3 "CAP availability is uptime / an SLA"

CAP's A is binary and per execution: every request at every non-failing node eventually answered, under any message loss. [G&L 2002 §2.2–2.3][gl02] It is not a percentage: footnote 4 replaced Brewer's "almost all requests" with "100% availability". [G&L 2002 fn. 4][gl02] Consequences:

- A majority-quorum system with five nines is not CAP-available. [HAT fn. 2, p. 184][hat13] [Kleppmann §2.1.1][kleppmann15]
- An unbounded-latency system can be CAP-available: "it puts no bound on how long the algorithm may run before terminating". [G&L 2002 §2.2][gl02]

Vendors draw this line themselves. CockroachDB: "'available' here means something different than the way it is used in the CAP theorem. In the CAP theorem, availability is a binary property, but for High Availability, we talk about availability as a spectrum". [CockroachDB FAQ][crdb-faq] FoundationDB: "A system that keeps some, but not all, of its nodes able to read and write is not Available in the CAP sense, even if it remains available to clients and satisfies its SLAs for high availability." [FoundationDB][fdb] Brewer 2017: "the actual theorem is about 100% availability, while the interesting discussion here is about the tradeoffs involved for realistic high availability." [p. 1][spanner17]

### 4.4 "CAP ignores latency" / "CAP only matters during a partition"

Both halves are partly true, and the primaries say exactly how far.

- **CAP's formal statement has no latency in it.** Brewer: "In its classic interpretation, the CAP theorem ignores latency". [Brewer 2012 p. 24][brewer12] Kleppmann: latency "is deliberately ignored by Gilbert and Lynch". [§4.1, p. 8][kleppmann15]
- **Operationally, the partition decision is a timeout.** "a partition is a time bound on communication". [Brewer 2012 p. 25][brewer12] That is Gilbert and Lynch's partially synchronous §4.3 algorithm: wait 2·t_msg + t_local, then answer with what you have.
- **Without timeouts, CAP bites even with no partition.** Corollary 1.1: in the asynchronous model you cannot be available always and atomic in every loss-free execution. [G&L 2002 §3.1, p. 54][gl02] [G&L 2012 §2, p. 3][gl12]
- **With no partition, the operative trade-off is latency, not availability.** "CAP is only relevant in the arguably rare case of a network partition", whereas the consistency/latency trade-off "is present at all times during system operation". [Abadi p. 41][abadi12] Kleppmann quantifies it in Table 1 (§3.5).

### 4.5 "CAP is about transactions / ACID" and its mirror "CAP only covers single-object linearizability, so it says nothing about transactions"

The proof is for one read/write register, and footnote 3 separates atomic consistency from ACID consistency. [G&L 2002 fn. 3, p. 52][gl02] Fox and Brewer's original C was one-copy ACID [§2][fb99], and Brewer 2012 still says "Isolation is at the core of the CAP theorem". [p. 24][brewer12] So:

- **Too broad:** CAP does not forbid available transactions. HAT shows read committed, monotonic atomic view and the session guarantees are highly available. [HAT §5.1, §5.3][hat13] Abadi: CAP "allows the system to make the complete set of ACID … guarantees alongside high availability when there are no partitions". [p. 38][abadi12]
- **Too narrow:** stronger isolation is unavailable too, but by separate arguments. HAT reduces lost-update prevention to linearizability and then cites CAP; write skew, SI, repeatable read and 1SR follow. [HAT §5.2.1, p. 187][hat13] Gilbert and Lynch: for "Complicated services … The same CAP trade-offs typically apply". [G&L 2012 §2, p. 2][gl12]

### 4.6 "CAP proves that eventual consistency is available"

Theorem 1 says nothing about eventual consistency. Kleppmann shows that in the model where Theorem 1 holds (infinite partitions) eventual consistency fails too, and that the difference only appears once you restrict both to loss-free executions. [§3.1.3, §3.2.3, pp. 6–8][kleppmann15] CAC's convergence property exists for the same reason: an always-available system that never propagates anything is trivially "consistent". [CAC §2.3][cac11] What makes an AP system useful is a convergence guarantee proved separately, such as strong eventual consistency for CRDTs ([Consistency models](consistency-models.md) §2.6).

### 4.7 "CAP and FLP are the same result"

They are different problems under different faults, and neither implies the other (§3.3). [G&L 2012 fn. 2][gl12]

---

## 5. How real systems classify themselves (first-party documentation)

All pages fetched 2026-11-21.

| System                        | Vendor's own words                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | In Gilbert & Lynch's terms                                                                                                                                                                                                                               |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Apache Cassandra 5.0          | "Cassandra chooses Availability and Partition Tolerance from the CAP guarantees, compromising on data Consistency to some extent." CAP's C is glossed as "every read receives the most recent write or errors out". [`guarantees.adoc:12–37`][cass-guarantees] Consistency levels give "a per-operation tradeoff between consistency and availability". [`dynamo.adoc:309–313`][cass-dynamo]                                                                                          | AP at the default levels. The same page lists "Lightweight transactions with linearizable consistency" (line 45), which are Paxos-based and so CP per operation: Brewer's fine-grained choice in one product.                                            |
| Amazon DynamoDB global tables | No CAP vocabulary on the page read. MREC: changes "are asynchronously replicated", an isolated replica's unreplicated data "will be replicated when the replica becomes healthy", conflicts are "last writer wins". MRSC: changes "are synchronously replicated to at least one other Region before the write operation returns", and strongly consistent reads "always return the latest version of an item". [global tables][ddb-global]                                            | MREC is AP; MRSC is CP. The docs do not say what MRSC does to a Region cut off from the other two; the CP reading is an inference from synchronous replication.                                                                                          |
| Google Cloud Spanner          | Brewer (2017): "The purist answer is 'no' because partitions can happen and in fact have happened at Google, and during (some) partitions, Spanner chooses C and forfeits A. It is technically a CP system." "If its actual availability is so high that users can ignore outages, then Spanner can justify an 'effectively CA' claim." [p. 1][spanner17] The product docs link that paper as the CAP statement. [TrueTime page][spanner-tt]                                          | CP. "Effectively CA" is a probabilistic claim about partitions being rarer than other outages (§4.2). The availability figures are Google's own.                                                                                                         |
| CockroachDB                   | "CockroachDB is a CP (consistent and partition tolerant) system. This means that, in the presence of partitions, the system will become unavailable rather than do anything which might cause inconsistent results." It is "also Highly Available, although 'available' here means something different". [FAQ][crdb-faq]                                                                                                                                                              | CP; HA in the quorum sense ("whenever a majority of replicas can talk to each other").                                                                                                                                                                   |
| YugabyteDB                    | "In terms of the CAP theorem, YugabyteDB is a consistent and partition-tolerant (CP) database which achieves very high availability at the same time. The architectural design of YugabyteDB is similar to Google Cloud Spanner, another CP system." [design goals][yb]                                                                                                                                                                                                               | CP, reusing Brewer's Spanner argument.                                                                                                                                                                                                                   |
| FoundationDB                  | "during a network partition FoundationDB chooses Consistency over Availability. This does not mean that the database becomes unavailable for clients." [CAP Theorem][fdb] Its opening sentence, "A database can provide strong consistency and system availability during network partitions", uses "system availability" in the HA sense the page defines later.                                                                                                                     | CP; available to the side holding a majority of coordination servers.                                                                                                                                                                                    |
| MongoDB                       | No CAP vocabulary on the pages read. "When the primary detects that it can only see a minority of voting nodes in the replica set, the primary steps down and becomes a secondary." [elections][mongo-el] "A rollback reverts write operations on a former primary when the member rejoins its replica set after a failover", and "does not occur if the write operations replicate to another member … [that] remains available and accessible to a majority". [rollbacks][mongo-rb] | Writes acknowledged by a majority behave CP (the minority side has no primary). Writes acknowledged by the old primary alone can be lost, which is why Abadi's 2012 classification was PA/EC [p. 42][abadi12]. The docs read do not classify themselves. |
| Azure Cosmos DB               | "Distributed databases that rely on replication for high availability, low latency, or both must balance read consistency, availability, latency, and throughput as defined by the PACELC theorem." Strong consistency "reduces availability during failures". [consistency levels][cosmos]                                                                                                                                                                                           | Frames its five levels with PACELC rather than CAP. Abadi presents PACELC as a "formulation", not a theorem [p. 41][abadi12].                                                                                                                            |
| HashiCorp Consul              | Three read modes per request. `stale`: "Since this mode allows reads without a leader, a cluster that is unavailable (no quorum) can still respond to queries." `consistent`: "strongly consistent without caveats. It requires that a leader verify with a quorum of peers that it is still leader." [consistency modes][consul]                                                                                                                                                     | The CP/AP choice is a per-request parameter, which is Brewer's "choice … can change according to the operation" [Brewer 2012 p. 24][brewer12].                                                                                                           |

**Patterns:**

1. **"CP + highly available" is the standard claim of consensus-based databases** (CockroachDB, YugabyteDB, FoundationDB, Spanner). All of them resolve it the same way: CAP's A is binary and per node; their HA is a percentage for clients on the majority side.
2. **"AP" is claimed per default configuration, not per system.** Cassandra offers linearizable LWTs, DynamoDB offers MRSC, Consul offers `consistent` reads. The classification belongs to an operation, as Brewer and Gilbert and Lynch (§4.4 "Operation partitioning") both say.
3. **The definitions vendors give for CAP's letters drift.** Cassandra's C ("most recent write or errors out") is closer to linearizability than its own quorum "strong consistency"; Brewer's 2017 C is "serializability for this discussion" [p. 1][spanner17]; FoundationDB's A is "Reads and writes always succeed". None quotes Gilbert and Lynch's definitions.

---

## 6. Relation to this repo

Read from the working tree at `02ee4f2`. One runtime probe was run (§6.6). Conclusions from [Consistency models](consistency-models.md) §6, which was read at `79bcd03`, are reused where the code they rest on is unchanged, and flagged where `e76db28` changed them.

### 6.1 Every operation completes locally: CAP-available in the strictest sense

- **Reads.** `query` runs the selector on the frozen in-memory view and returns [`store.ts:53–59`][nn-store]. React reads through it synchronously (`getSnapshot = () => store.query(...)`, [`react/src/index.ts:54`][nn-react]).
- **Writes.** `mutate` runs the recipe on a draft and commits synchronously [`store.ts:69–83, 130–160`][nn-store]. Nothing in `Store` awaits a network or disk operation.
- **Sync is a side channel.** A connected engine forwards changes with a fire-and-forget `void this.send(changes)` [`sync-engine.ts:47–51`][nn-engine]; a failed push is reported to `onError` and not retried [`sync-engine.ts:126–136`][nn-engine].
- **The node is the tab.** A replica is one JavaScript realm, and the example wires IndexedDB, BroadcastChannel and the server into every tab [`apps/example-react/src/store.ts:9–20`][nn-app-store]. This is unchanged from [Consistency models](consistency-models.md) §6.1.

So every request received by a non-failing node gets a response "even if every other node in the network fails (i.e. the node is in its own unique component of the partition)", which is Gilbert and Lynch's wait-free reading of availability. [G&L 2002 §2.3, p. 53][gl02] In Kleppmann's terms both operations are delay-independent, O(1) in network delay, which is what "supports disconnected (offline) operation" means. [Kleppmann §4.4–4.5][kleppmann15] In HAT's terms the client is its own server, the case where "A client may choose to become sticky available by acting as a server itself". [HAT §4.1, p. 184][hat13] It is the case Brewer singled out: "part of the service runs on the client … These systems normally choose A over C and thus must recover from long partitions." [Brewer 2012 p. 25][brewer12] The repo's own claim is the same: changes "made offline, in other tabs, or on other devices merge" [`README.md:3`][nn-readme].

### 6.2 Therefore not linearizable: Theorem 1 on two devices

Theorem 1 applies unchanged. Replay its α:

```text
Device A (offline):  mutate(title = "Final")   → returns immediately
Device B (offline):                                 query(title) → "Draft"   ← read began after A's write returned
No algorithm could make B return "Final" without a message from A; @goodstate returns at once, so it is not linearizable.
```

The same holds for two tabs in one browser, because `BroadcastChannel.postMessage` is asynchronous [`broadcast-sync.ts:39–43`][nn-bc]. Every guarantee the store can offer is therefore below the availability boundary in [Consistency models](consistency-models.md) §3.

In PACELC terms the store is **PA/EL**: it chooses availability under partition and low latency otherwise, since local operations never wait even when every engine is connected. This classification is mine; Abadi did not classify local-first stores.

### 6.3 Partition handling in Brewer's terms

| Brewer 2012 step                | `@goodstate` at `02ee4f2`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Detect the partition            | Each engine has a `Session` state machine (`connected`, `disconnected`, …) [`session.ts:121–155`][nn-session], and SSE drops the session when the stream closes [`sse-sync.ts:34`][nn-sse]. The store does not consult it: operations behave the same in every state.                                                                                                                                                                                                                                                         |
| Partition mode                  | Permanent. No operation is limited, delayed or modified while disconnected, so no invariant is protected. Brewer's operation × invariant table is empty because the schema has no cross-replica invariants.                                                                                                                                                                                                                                                                                                                   |
| Recovery: make state consistent | On connect an engine pulls each root and merges it [`sync-engine.ts:27–46`][nn-engine], and then pushes its whole encoded state [`sync-engine.ts:47–48`][nn-engine]; the server sends its snapshot as the first SSE event [`routes/sync.ts:55`][nn-route]. ADR-16 chose this over an outbox: "pushing every field on connection reaches the same result without storing anything" ([ADR-16][adr16] line 63). Merge is a join of state-based CRDTs, which is Brewer's "represent values on a lattice" route [p. 27][brewer12]. |
| Recovery: compensate            | None. Conflicts resolve by last-writer-wins, which Brewer lists as the "trivial" fix "which ignores some updates" [p. 28][brewer12], and tombstones win over concurrent edits ([Consistency models](consistency-models.md) §6.8, row 8).                                                                                                                                                                                                                                                                                      |

### 6.4 Where `@goodstate` sits inside AP

**Convergence.** [Consistency models](consistency-models.md) §6.3 still holds at `02ee4f2`. The example server replaces each pushed field instead of merging [`memory-database.ts:8–10`][nn-memdb] [`redis-database.ts:30–38`][nn-redisdb] ([ADR-15][adr15] line 42), and [ADR-16][adr16] line 87 records the race where one client's push overwrites another's. So the store is strongly eventually consistent for register values and row membership only on condition that every replica eventually reconnects. Row order does not converge (`// TODO!: Ordering is not converged yet`, [`rga.ts:8`][nn-rga]), so the README's "merge into the same result" holds for values and membership, not for list order. In CAC's vocabulary, BroadcastChannel and IndexedDB paths behave like one-way anti-entropy between live replicas; the server path is not one-way convergent while it replaces. That is an inference from the code.

**What changed since `79bcd03`: the receive rule.** `GlobalTime.receive` advances the clock to a newer remote time [`global-time.ts:42–50`][nn-global-time], and `LWWRegister.decode` calls it for every decoded register [`lww-register.ts:68–76`][nn-register]. Every remote root enters through `Codec.decode`, which recurses through maps and lists into their registers [`codec.ts:22–29`][nn-codec], before `Store.merge` merges it [`store.ts:104–115`][nn-store]. The new tests check both the direct case and a register nested in a map [`lww-register.test.ts:273–291`][nn-register-test]. Consequences for the table in [Consistency models](consistency-models.md) §6.4:

- **Writes-follow-reads in Viotti and Vukolić's arbitration form now holds** within a tab: a write made after merging a remote value is stamped after it. That note's "No" and its anomaly #1 in §6.8 are outdated. This is an inference from the code and the unit tests, not a two-device test.
- **Terry's propagation half still fails across roots**, because each changed root is pushed as its own message [`sync-engine.ts:126–136`][nn-engine] [`sse-sync.ts:46–54`][nn-sse] [`broadcast-sync.ts:39–43`][nn-bc].
- **Causal visibility across roots, MAV for multi-root mutations, and SEC for list order still fail**, for the reasons in that note's §6.4–6.5; the code paths it cites are unchanged in substance at `02ee4f2`.

So the store is still neither causal nor causal+. COPS-style causal+ is the ceiling for a last-writer-wins store that stays available ([Consistency models](consistency-models.md) §2.3), and CAC's real-time causal bound does not bind it, since CAC assumes reads may return all concurrent writes. The remaining work to reach causal+ is that note's §6.7 list minus item 1, which `e76db28` delivered without a drift bound.

### 6.5 What CAP and its successors rule out while writes stay local

Unchanged from [Consistency models](consistency-models.md) §6.7: linearizable reads, uniqueness and other invariants, lost-update and write-skew prevention, and snapshot isolation are unavailable. [G&L 2002 Thm 1][gl02] [HAT §5.2][hat13] Brewer's two ways to get them back both cost availability for the affected operations only:

- **Delay or forbid the operation in partition mode** ("prohibit, delay, or modify"), for example a uniqueness-checked rename that requires the server. [Brewer 2012 p. 26][brewer12]
- **Allow it and compensate after recovery**, as the ATM does within a bound k. [Brewer 2012 p. 28][brewer12]

Gilbert and Lynch's "operation partitioning" is the same idea as a system design: "a 'purchase' operation should guarantee consistency, while a 'query' operation might return out of date data." [G&L 2012 §4.4, p. 8][gl12]

### 6.6 A new availability hole: the receive rule has no drift bound

`receive` adopts any newer remote time and counter [`global-time.ts:42–50`][nn-global-time]. `tick` increments the counter while the wall clock has not passed the stored time, and throws `CounterOverflowError` once the counter reaches `16 ** 5 − 1` [`global-time.ts:8, 23–34`][nn-global-time]. The error text itself says "Reaching the upper bound means clock drift, not throughput." [`counter-overflow-error.ts:9`][nn-overflow]

A probe run with the repo's vitest from the scratchpad, importing `packages/time/src/time.ts`, confirmed two things:

1. After `Time.receive(new Time(Date.now() + 10 min, 0, …))`, the next `Time.now()` is after the remote time.
2. After `Time.receive(new Time(Date.now() + 1 h, 16 ** 5 − 1, …))`, the next `Time.now()` throws `CounterOverflowError`. In a run where both cases shared one module, the second case failed too: the clock stayed pinned until the wall clock passes the received time.

The register setter stamps with `Time.now()` [`lww-register.ts:33–37`][nn-register], so a `mutate` that sets a register would throw for as long as the wall clock is behind the received time. That step was not executed through `Store`; it is an inference from the code. Two ways to reach it:

- **One bad stamp**: a peer or server that sends a register stamped ahead with a saturated counter blocks every local write on every replica that decodes it.
- **Ordinary skew**: after receiving a stamp T ahead, each local write until the wall clock reaches T uses the next counter value, so about a million local register writes during the skew window exhaust it.

In CAP terms this is a liveness failure caused by input rather than by a partition: a non-failing node stops answering write requests. The [HLC note](hybrid-logical-clocks.md) §7.3 describes the drift bounds other systems use (reject or clamp remote times beyond a maximum offset); `@goodstate` has none at `02ee4f2`.

### 6.7 For the thesis

The CAP subsection of the thesis [`consistency-models.tex:38–55`][thesis-cap] cites textbooks. The primary for each of its claims:

| Thesis claim                                                                                                                                 | Primary source                                                                                                                                                                                       |
| -------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| C: "operations behave as if performed on one copy, respecting real-time order"                                                               | [G&L 2002 §2.1, p. 52][gl02]; linearizability in [HW90][hw90] via [Consistency models](consistency-models.md) §2.1                                                                                   |
| A: "every request received by a non-failing node to complete eventually with an operation result; merely returning an error is insufficient" | First half verbatim in [G&L 2002 §2.2, p. 53][gl02]. The "error is insufficient" half is not stated in those words; the closest is "a valid (atomic) response must be generated" [§2.3, p. 53][gl02] |
| P: "the guarantees to hold even when communication between parts of the system fails"                                                        | [G&L 2002 §2.3, p. 53][gl02]                                                                                                                                                                         |
| "an asynchronous read/write system cannot guarantee both C and A in executions that permit such partitions"                                  | [G&L 2002 Thm 1, p. 53][gl02]. Theorem 2 extends it to the partially synchronous model [p. 56][gl02], so "asynchronous" understates it                                                               |
| "CAP does not rule out weaker consistency guarantees"                                                                                        | [G&L 2002 §3.2.3, p. 55; §4.4, pp. 56–57][gl02]; the ceilings are [CAC Thm 3.1][cac11] and [HAT §5.3][hat13]                                                                                         |

---

## 7. What could not be verified

**Sources**

- **PODC 2000.** Only the slides were read. The proceedings entry Brewer 2012 cites ("pp. 7-10") was not read, nor the "talk slides and notes" Gilbert and Lynch thank Brewer for. The slide PDF was distilled in January 2004, so whether it matches what was shown in July 2000 is unknown. The slides define C, A and P by name only.
- **Fox & Brewer 1999.** Read from a 2002 Ghostscript course copy; the IEEE version was not read, and the copy's pages are not the proceedings pages. The numeric value after "four-nines availability means a completion probability of" did not survive text extraction.
- **Gilbert & Lynch 2002.** Page numbers come from a scanned SIGACT News issue on a course site, whose OCR is noisy; quotes follow the MIT author copy, compared against the scan for Theorem 1, Corollary 1.1, §2.2–2.3 and Definition 3. The ACM Digital Library copy was not read. The NUS-hosted file is an earlier draft ("Delayed-t"); when it was written is not stated in it.
- **Gilbert & Lynch 2012.** The author preprint (December 2011) was read, not the IEEE Computer version; page numbers are preprint pages.
- **Kleppmann 2015.** arXiv v2, not peer-reviewed. The latency lower bounds in his Table 1 (Attiya and Welch; Lipton and Sandberg; Mavronicolas and Roth) were taken from his summary and not read in the original papers.
- **FLP.** Only the abstract and §1 were read, not the proof.
- **CAC.** The 2011 technical report was read, not any later published version. The task's phrasing "causal consistency is the strongest achievable" matches Brewer's 2012 paraphrase; the theorem itself is about real-time causal consistency.
- **Attiya, Ellen, Morrison.** Abstract and introduction only.
- **Not read:** Brewer's "Lessons from Giant-Scale Services" (2001), the Abadi and Hale blog posts Brewer 2012 cites (refs 5–6), Davidson et al. 1985 and other pre-CAP partition literature Kleppmann cites, and Lynch's _Distributed Algorithms_ chapters the 2002 proof relies on.

**Vendors**

- **Spanner.** The availability figures ("better than 5 9s", the incident pie chart) are Google's own and were not independently checked. The whitepaper's author is also CAP's author and a Google employee, which he discloses in footnote 1.
- **Cassandra.** Read from the `cassandra-5.0` branch source at `3e3892ce`, not the rendered site.
- **DynamoDB.** The page does not state what an MRSC Region does when cut off from the other two; "CP" for MRSC is an inference.
- **MongoDB.** The manual pages show no version. They do not use CAP vocabulary; the mapping to CP for majority writes is mine.
- **YugabyteDB.** The `/preview/` docs were read, not a stable release's.
- **Not checked:** Riak, Couchbase, ScyllaDB, etcd, TiDB, Fauna.

**This repository**

- Only `Time.now`/`Time.receive` were executed (§6.6). That `Store.mutate` throws in the overflow case, and that writes-follow-reads now holds end to end across devices, are inferences from the code and the unit tests.
- Whether the BroadcastChannel and IndexedDB paths meet CAC's one-way convergence definition exactly was not proved; §6.4 states it as an inference.
- The classification PA/EL is mine; no source classifies `@goodstate`.

---

## References

[fb99]: https://users.ece.cmu.edu/~adrian/731-sp04/readings/FB-cap.pdf
[podc00]: https://people.eecs.berkeley.edu/~brewer/cs262b-2004/PODC-keynote.pdf
[gl02]: https://sites.cs.ucsb.edu/~rich/class/cs293b-cloud/papers/cap-proof.pdf
[gl02-mit]: https://groups.csail.mit.edu/tds/papers/Gilbert/Brewer6.ps
[gl02-draft]: https://www.comp.nus.edu.sg/~gilbert/pubs/BrewersConjecture-SigAct.pdf
[gl12]: https://groups.csail.mit.edu/tds/papers/Gilbert/Brewer2.pdf
[brewer12]: https://sites.cs.ucsb.edu/~rich/class/cs293b-cloud/papers/brewer-cap.pdf
[abadi12]: http://www.cs.umd.edu/~abadi/papers/abadi-pacelc.pdf
[kleppmann15]: https://arxiv.org/pdf/1509.05393v2
[cac11]: https://cs.utexas.edu/~dahlin/papers/cac-tr.pdf
[hat13]: http://www.vldb.org/pvldb/vol7/p181-bailis.pdf
[aem15]: https://www.cs.tau.ac.il/~mad/publications/podc2015-replds.pdf
[flp85]: https://groups.csail.mit.edu/tds/papers/Lynch/jacm85.pdf
[hw90]: https://cs.brown.edu/~mph/HerlihyW90/p463-herlihy.pdf
[spanner17]: https://storage.googleapis.com/gweb-research2023-media/pubtools/pdf/45855.pdf
[cass-guarantees]: https://github.com/apache/cassandra/blob/3e3892ce99a58f0f88eaf21f7cc836d7b5184210/doc/modules/cassandra/pages/architecture/guarantees.adoc
[cass-dynamo]: https://github.com/apache/cassandra/blob/3e3892ce99a58f0f88eaf21f7cc836d7b5184210/doc/modules/cassandra/pages/architecture/dynamo.adoc
[ddb-global]: https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/V2globaltables_HowItWorks.html
[crdb-faq]: https://docs.cockroachlabs.com/docs/stable/frequently-asked-questions
[yb]: https://docs.yugabyte.com/preview/architecture/design-goals/
[fdb]: https://apple.github.io/foundationdb/cap-theorem.html
[mongo-el]: https://www.mongodb.com/docs/manual/core/replica-set-elections/
[mongo-rb]: https://www.mongodb.com/docs/manual/core/replica-set-rollbacks/
[cosmos]: https://learn.microsoft.com/en-us/azure/cosmos-db/consistency-levels
[spanner-tt]: https://cloud.google.com/spanner/docs/true-time-external-consistency
[consul]: https://developer.hashicorp.com/consul/api-docs/features/consistency
[nn-store]: ../../../packages/store/src/store.ts
[nn-react]: ../../../packages/react/src/index.ts
[nn-engine]: ../../../packages/sync-engine/src/sync-engine.ts
[nn-session]: ../../../packages/sync-engine/src/session.ts
[nn-sse]: ../../../packages/sse-sync/src/sse-sync.ts
[nn-bc]: ../../../packages/broadcast-sync/src/broadcast-sync.ts
[nn-global-time]: ../../../packages/time/src/global-time.ts
[nn-overflow]: ../../../packages/time/src/errors/counter-overflow-error.ts
[nn-register]: ../../../packages/entities/src/lww-register.ts
[nn-register-test]: ../../../packages/entities/src/lww-register.test.ts
[nn-codec]: ../../../packages/entities/src/codec.ts
[nn-rga]: ../../../packages/entities/src/rga.ts
[nn-memdb]: ../../../apps/example-server/src/services/database/memory-database.ts
[nn-redisdb]: ../../../apps/example-server/src/services/database/redis-database.ts
[nn-route]: ../../../apps/example-server/src/routes/sync.ts
[nn-app-store]: ../../../apps/example-react/src/store.ts
[nn-readme]: ../../../README.md
[adr15]: ../../decisions/ADR-15-stream-remote-changes-over-server-sent-events.md
[adr16]: ../../decisions/ADR-16-give-sync-engines-a-connection-lifecycle.md
[thesis-cap]: ../../thesis/chapters/consistency-models.tex
