# Replication topologies: who accepts writes, who talks to whom, and what it costs

Research date: **2026-11-18** (original papers, official documentation, pinned source code, and one runtime probe against this repository).
Scope: how replicas are arranged and how a write travels between them, and what each arrangement implies for consistency, write availability, conflict handling, latency, failure and partition behaviour, and fan-out cost. The last part places `@goodstate` among the options. Companions in this directory, which this note links to instead of repeating: [Local-first web architecture](local-first-architecture.md) (authority models, wire units, multi-tab), [Local-first software](local-first-software.md) (the 2019 essay, cloud peers, Automerge Repo, Beelay), [CRDT deltas](crdt-deltas.md) (Automerge and Yjs sync, delta-state CRDTs, causal readiness), [Hybrid Logical Clocks](hybrid-logical-clocks.md) (LWW timestamps and clock pitfalls), [Persisting CRDT metadata](crdt-metadata-persistence.md) (multi-tab lost updates) and [Keyhive](keyhive.md) (untrusted relays).

**Papers** (PDFs fetched 2026-11-18 unless they are in `docs/papers/`):

- R. van Renesse, F. B. Schneider, "Chain Replication for Supporting High Throughput and Availability", OSDI 2004 ([pdf][chain]).
- J. Terrace, M. J. Freedman, "Object Storage on CRAQ: High-throughput chain replication for read-mostly workloads", USENIX ATC 2009 ([pdf][craq]).
- G. DeCandia et al., "Dynamo: Amazon's Highly Available Key-value Store", SOSP 2007 ([pdf][dynamo]).
- L. Lamport, "Paxos Made Simple", 1 Nov 2001 ([pdf][paxos]).
- D. Ongaro, J. Ousterhout, "In Search of an Understandable Consensus Algorithm (Extended Version)", 2014 ([pdf][raft]); D. Ongaro, "Consensus: Bridging Theory and Practice", PhD dissertation, Stanford, 2014 ([pdf][ongaro]).
- D. B. Terry et al., "Managing Update Conflicts in Bayou, a Weakly Connected Replicated Storage System", SOSP 1995 ([pdf][bayou]).
- A. Demers et al., "Epidemic Algorithms for Replicated Database Maintenance", PODC 1987. Read from a course-hosted scan whose OCR is poor in places ([pdf][demers]).
- R. van Renesse, D. Dumitriu, V. Gough, C. Thomas, "Efficient Reconciliation and Flow Control for Anti-Entropy Protocols" (Scuttlebutt), LADIS 2008 ([pdf][scuttlebutt]).
- M. Shapiro, N. Preguiça, C. Baquero, M. Zawirski, "Conflict-free Replicated Data Types", SSS 2011 ([`docs/papers/CRDTs_SSS-2011.pdf`][shapiro]).
- P. S. Almeida, A. Shoker, C. Baquero, "Delta State Replicated Data Types", arXiv:1603.01529v1, 4 Mar 2016 ([arXiv][delta]). The 2018 JPDC version is the one [CRDT deltas](crdt-deltas.md) §6 cites; definitions used here match.
- M. Kleppmann, A. Wiggins, P. van Hardenberg, M. McGranaghan, "Local-First Software: You Own Your Data, in spite of the Cloud", Onward! 2019 ([`docs/papers/local-first.pdf`][lfs]).
- P. Nicolaescu, K. Jahns, M. Derntl, R. Klamma, "Near Real-Time Peer-to-Peer Shared Editing on Extensible Data Types" (YATA, the Yjs paper), GROUP 2016 ([`docs/papers/GROUP2016.pdf`][yata]).

**Official documentation** (fetched 2026-11-18):

| System               | Version or date of the docs read                                                                                                              | Pages                                                                                                                                                                                                                                                                                                                                                                                          |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PostgreSQL           | 18.7                                                                                                                                          | [Log-shipping standby servers][pg-standby], [`synchronous_commit`][pg-wal], [Logical replication][pg-logical], [Logical replication conflicts][pg-conflicts], [`CREATE SUBSCRIPTION`][pg-createsub]                                                                                                                                                                                            |
| MySQL                | 8.4 Reference Manual                                                                                                                          | [Semisynchronous replication][my-semisync], [`log_replica_updates`][my-binlog-opts], [replica options][my-replica-opts], [Multi-source replication][my-multisource], [Group Replication background][my-gr-bg], [Group Replication summary][my-gr-summary], [Multi-primary mode][my-gr-mp], [NDB bidirectional and circular replication][ndb-circular], [NDB conflict resolution][ndb-conflict] |
| Apache Cassandra     | `apache/cassandra@53c3561e9db3fa0b1ed8e29ce462fde6ce566ff0` (trunk, `base.version` 7.0, 2026-11-18); cassandra.apache.org refused connections | `doc/modules/cassandra/pages/architecture/dynamo.adoc` ([source][cass-dynamo])                                                                                                                                                                                                                                                                                                                 |
| Amazon DynamoDB      | Developer Guide, global tables version 2019.11.21 (Current)                                                                                   | [How global tables work][ddb-gt]                                                                                                                                                                                                                                                                                                                                                               |
| CockroachDB          | "stable" docs, links point to v26.4                                                                                                           | [Replication layer][crdb-repl]                                                                                                                                                                                                                                                                                                                                                                 |
| etcd                 | v3.6 docs                                                                                                                                     | [Learner design][etcd-learner]                                                                                                                                                                                                                                                                                                                                                                 |
| Apache Kafka         | 4.4                                                                                                                                           | [Design: replication][kafka-design]                                                                                                                                                                                                                                                                                                                                                            |
| Google Cloud Spanner | no date shown                                                                                                                                 | [Replication][spanner-repl]                                                                                                                                                                                                                                                                                                                                                                    |
| CouchDB, PouchDB     | CouchDB "stable" (no version shown); PouchDB guide                                                                                            | [Replication intro][couch-intro], [Replication and conflict model][couch-conflicts], [PouchDB replication guide][pouch-repl]                                                                                                                                                                                                                                                                   |
| Automerge Repo, Yjs  | automerge.org and docs.yjs.dev as of 2026-11-18                                                                                               | [Automerge networking][am-net-doc], [Yjs document updates][yjs-updates]                                                                                                                                                                                                                                                                                                                        |

**Source code** (shallow clones, read without running):

- `yjs/yjs@ee37f0a0e23a7c3e14531bae335d439e54c743e6` (2026-11-16), `yjs/y-websocket@c20c7425ef24f25bd4e15490546a009912c83fb2` (2026-11-18), `yjs/y-webrtc@c411f1d7223b68f3c6fc9c5901a19819a17db667` (2024-04-28).
- `automerge/automerge-repo@6e2101acbf1151cf35d6bd17b7dc61a6384fc828` (2026-10-31).
- This repository at `79bcd03` (2026-11-18), with the ADRs in `docs/decisions/`.

**Secondary, flagged wherever used:** M. Kleppmann, _Distributed Systems_ lecture notes, University of Cambridge, Michaelmas 2021/22 ([pdf][kl-notes]). It is teaching material that summarises the literature. It is used for the broadcast hierarchy in §1 and the O(n²) cost of eager re-broadcast in §6, and nowhere as the only source for a system's behaviour.

Section 10 lists what could **not** be verified. Section 9 relates the findings to `@goodstate`.

---

## Short answer

A replication topology answers two questions: **which replicas may accept a write**, and **along which links a write travels to the rest**. The first decides conflicts and partition behaviour. The second decides latency, fan-out and what ordering the network gives you for free.

1. **One writer (single leader, primary-backup).** The leader orders every write, so there are no write-write conflicts. Writes stop when the leader is unreachable. Sync, semi-sync and async differ only in how many copies the leader waits for before it acknowledges. PostgreSQL says async failover loses data "proportional to the replication delay" ([PostgreSQL][pg-standby]). MySQL semi-sync silently "reverts to asynchronous replication" on timeout ([MySQL][my-semisync]). Cascading (tree) replicas cut the leader's fan-out at the price of more hops, and PostgreSQL's cascading is asynchronous only.
2. **Chain replication** is primary-backup laid out as a line. The head orders writes, the tail answers reads and replies, and a write costs the _sum_ of hop latencies instead of the _maximum_ ([van Renesse & Schneider][chain]). CRAQ lets every node serve reads of clean versions, and asks the tail only for dirty ones ([Terrace & Freedman][craq]).
3. **Consensus (Raft, Multi-Paxos)** is a single leader that is _elected_ and that commits on a majority. It tolerates ⌊(n−1)/2⌋ failures and keeps the minority side of a partition read-only or down ([Raft][raft]). Non-voting replicas (Raft learners, etcd learners, CockroachDB non-voting replicas, Spanner read-only replicas) add read copies without growing the quorum. Witnesses vote without holding data. Kafka's ISR is the primary-backup alternative: f+1 copies for f failures, with membership decided by an external controller ([Kafka][kafka-design]).
4. **Multiple writers with leader links (multi-leader).** Every site takes writes, so conflicts are inevitable and the link graph matters. A chain or ring needs every node to re-log what it receives (MySQL `log_replica_updates`) and loop prevention (server IDs, GTIDs, PostgreSQL `origin = none`). Any graph with two paths between two sites can deliver writes out of order: MySQL says plainly that "there is no guarantee that Cluster 3's updates originating directly from Cluster 1 are more recent than those received through Cluster 2" ([NDB][ndb-circular]). Systems then pick a conflict rule: last-writer-wins (DynamoDB MREC, Cassandra, NDB `NDB$MAX`), a designated winner (NDB `NDB$EPOCH`, Bayou's primary commit), certification with first-committer-wins (MySQL Group Replication), or keep every version and let the app decide (Dynamo, CouchDB).
5. **Leaderless quorums (Dynamo).** Any of N replicas takes a write, the coordinator waits for W and a read for R, and R + W > N gives a "quorum-like" overlap. Dynamo then deliberately weakens it with sloppy quorums and hinted handoff to stay "always writeable", and repairs divergence with read repair and Merkle-tree anti-entropy ([Dynamo][dynamo]).
6. **Gossip (epidemic) dissemination** has no fixed links at all. Each site periodically picks a random partner. Pull or push-pull converges much faster than push once most sites have an update, and deletes need death certificates or they resurrect ([Demers et al.][demers]). Spread time grows logarithmically with the number of hosts ([Scuttlebutt][scuttlebutt]).
7. **Local-first CRDT systems** use two shapes: a **star** around a server, and a **peer mesh**. A star server is either an authoritative merger or a store-and-forward relay. The essay calls the relay a "cloud peer" that is not "on the critical path" ([Kleppmann et al.][lfs]). The CRDT style sets what the links must guarantee. Op-based CRDTs need reliable causal broadcast. State-based CRDTs need only eventual delivery over "fair-lossy" channels ([Shapiro et al.][shapiro]). Delta-state CRDTs converge over an unreliable layer, and need delta-intervals plus the "causal delta-merging condition" for causal consistency ([Almeida et al.][delta]). A star with one in-order relay gives causal order for free. A second path (tabs, P2P) takes it away, so op-based replicas must buffer until causally ready, as Yjs and Automerge do ([CRDT deltas](crdt-deltas.md) §5–6).
8. **Where `@goodstate` sits** (§9): leaderless and multi-writer, with state-based CRDT roots shipped whole. Each tab is a full replica wired three ways: a star to a server that **stores and replaces** (it does not merge), an all-to-all `BroadcastChannel` mesh between same-origin tabs, and a shared IndexedDB. No engine tags the origin of a change, so every replica re-pushes any merge that changed its state on every link. That is flooding, terminated by idempotent merge. The probe in §9.2 measured **n uploads and n² downloads of a whole root for one edit among n clients**. The echo is load-bearing: it is how the non-merging server's copy catches up to the join (ADR-16). State-based CRDTs make this safe under any delivery order and any number of paths. The cost is fan-out, plus the server-copy regression that [Local-first web architecture](local-first-architecture.md) §8.2 describes.

---

## 1. What a topology decides

Two choices define every arrangement in this note:

- **Write acceptance.** One replica (leader, primary, head), a majority-elected one (consensus), several fixed ones (multi-leader), any of N (leaderless quorum), or every replica (gossip, CRDT replicas).
- **Propagation graph.** Star from the leader, a tree, a chain, a ring, all-to-all, random partners per round, or a relay hub.

The ordering a topology can give follows from those two. The Cambridge lecture notes (secondary) summarise the hierarchy: FIFO, causal, and total order broadcast, where total order "can [be implemented] by sending all messages via a single leader", and where a weaker broadcast requires the update function to make up the difference ([Kleppmann notes][kl-notes], Slides 86 and 104):

| Broadcast the topology provides | What the replica's update function must be (Slide 104, secondary) |
| ------------------------------- | ----------------------------------------------------------------- |
| total order                     | deterministic (state machine replication)                         |
| causal                          | deterministic, concurrent updates commute                         |
| reliable                        | deterministic, all updates commute                                |
| best-effort                     | deterministic, commutative, idempotent, tolerates message loss    |

The same notes call primary-backup "equivalent to total order broadcast of transaction commit records". That framing is useful for the whole note: single-leader and consensus topologies buy total order with a leader, and everything to the right in the table above shifts work from the topology to the data type.

## 2. One writer: primary-backup and its shapes

### 2.1 Synchronous, semi-synchronous, asynchronous

The leader orders writes; the variants differ in what an acknowledgement means.

**Asynchronous.** PostgreSQL: "Streaming replication is asynchronous by default … in which case there is a small delay between committing a transaction in the primary and the changes becoming visible in the standby." On failover, "some transactions that were committed may not have been replicated … The amount of data loss is proportional to the replication delay at the time of failover" ([PostgreSQL 18][pg-standby]). MySQL describes the same mode: "there is no guarantee that any event ever reaches any replica" ([MySQL 8.4][my-semisync]).

**Synchronous.** PostgreSQL makes a commit "wait until confirmation is received that the commit has been written to the write-ahead log on disk of both the primary and standby server". It is configured as a priority list (`FIRST 2 (s1, s2, s3)`) or as a quorum (`ANY 2 (s1, s2, s3)`, "at least the requested number") ([PostgreSQL 18][pg-standby]). So PostgreSQL's synchronous mode is already a k-of-n quorum over standbys. The acknowledgement point is tunable per transaction ([`synchronous_commit`][pg-wal]):

- `remote_write`: the standby "written it to their file systems";
- `on`: "flushed it to durable storage";
- `remote_apply`: "applied it, so that it has become visible to queries on the standby(s)".

Only `remote_apply` gives read-your-writes on a standby. The availability cost is explicit: commits "may never be completed if any one of the synchronous standbys should crash", and the documented remedy is to lower the count or disable synchronous replication ([PostgreSQL 18][pg-standby]).

**Semi-synchronous.** MySQL's middle ground: "The source waits until at least one replica has received and logged the events … and then commits the transaction." The replica acknowledges "after the events have been written to its relay log and flushed to disk", not after applying them. When nobody acknowledges in time, "the source reverts to asynchronous replication", and returns to semi-sync when a replica catches up ([MySQL 8.4][my-semisync]). So under a partition MySQL semi-sync chooses write availability over durability, and PostgreSQL synchronous replication chooses durability over write availability.

### 2.2 Cascading and tree-shaped replicas

A replica can itself be a source. PostgreSQL: a standby can "accept replication connections and stream WAL records to other standbys, acting as a relay". It names the roles "cascading standby", "upstream" and "downstream", and adds: "Cascading replication is currently asynchronous. Synchronous replication … settings have no effect on cascading replication at present" ([PostgreSQL 18][pg-standby]). MySQL chains the same way. With `log_replica_updates` (default on), in `A -> B -> C` "B must be both a source _and_ a replica", logging what it receives so it can pass it on ([MySQL 8.4][my-binlog-opts]).

A tree trades leader fan-out (the leader feeds only its direct children) for staleness that grows with depth and for a dependency on every intermediate node. Logical replication can cascade too: subscribers "may subsequently re-publish data to allow cascading replication or more complex configurations" ([PostgreSQL 18][pg-logical]).

### 2.3 Chain replication and CRAQ

Chain replication orders the replicas of an object in a line. "Each update request is directed to the head of the chain", processed there, and "forwarded along a reliable FIFO link to the next element … until the request is handled by the tail". "The reply for every request is generated and sent by the tail", and queries go to the tail, so "query requests and update requests are all processed serially at a single server (the tail)" ([van Renesse & Schneider][chain] §3). Properties stated in the paper:

- With t replicas, "as many as t−1 of the servers can fail without compromising the object's availability".
- The head computes the new value once and forwards state, so "update can be a non-deterministic operation—the non-deterministic choice is made once, by the head".
- Latency is the price: chain replication disseminates "serially, resulting in higher latency than the primary/backup approach where requests were distributed to backups in parallel … proportional to the sum of those latencies" instead of the maximum (§4).
- Failure handling relies on "a service, called the master", which the prototype replicates "using Paxos". Head failure makes updates unavailable for 2 message delays, tail failure makes queries and updates unavailable for 2, and a middle failure delays without an outage. Primary failure in primary-backup costs 5 (§3, §4).

CRAQ keeps the chain and spreads reads. Each node keeps versions marked clean or dirty. A clean read is answered locally by "any node". For a dirty object, "the node contacts the tail and asks for the tail's last committed version number (a version query)" ([Terrace & Freedman][craq] §2.3). CRAQ also offers per-read "Eventual Consistency" and "Eventual Consistency with Maximum-Bounded Inconsistency" for clients that prefer locality, or that must keep working "during partitions" (§2.4). For wide-area chains, CRAQ stores chain membership in ZooKeeper (§3.4).

### 2.4 What a single writer gives and costs

- **Consistency:** total order of writes, no write conflicts. Reads from followers are stale unless the protocol says otherwise (chain tail, CRAQ version query, PostgreSQL `remote_apply`).
- **Write availability:** only where the leader is. Failover needs someone to pick a new leader: a human, an external master (chain replication), or consensus (§3).
- **Fan-out per write:** n−1 copies from the leader in a star, 1 from each node in a chain or tree.

## 3. Consensus: an elected leader with a majority

### 3.1 Roles

Paxos defines "three classes of agents: proposers, acceptors, and learners". Learners only find out which value was chosen. Lamport notes the fan-out trade-off: every acceptor can tell every learner ("the product of the number of acceptors and the number of learners"), or a "distinguished learner" relays ("the sum"), which costs a round and is "less reliable". For a state machine, "a single server is elected to be the leader, which acts as the distinguished proposer … in all instances", and "each server plays all the roles (proposer, acceptor, and learner)" ([Paxos Made Simple][paxos]).

Raft makes that leader explicit. "At any given time each server is in one of three states: leader, follower, or candidate … Followers are passive … The leader handles all client requests (if a client contacts a follower, the follower redirects it to the leader)." The cluster is "fully functional (available) as long as any majority of the servers are operational … a typical cluster of five servers can tolerate the failure of any two servers" ([Raft][raft] §2, §5.1).

Reads can bypass the log and stay linearizable. The leader records a `readIndex` and confirms leadership with a heartbeat round, or holds a clock-based lease. Followers can serve reads by asking the leader for a current `readIndex`, because "a partitioned follower might not receive any new log entries from the leader for long periods of time" ([Ongaro][ongaro] §6.4).

### 3.2 Non-voting replicas and witnesses

The quorum and the set of copies do not have to be the same set.

- **Raft non-voting members.** A new server joins "as a non-voting member. The leader replicates log entries to it, but it is not yet counted towards majorities." Ongaro adds that the mechanism "can be used to replicate the state to a large number of servers, which can serve read-only requests with relaxed consistency" ([Ongaro][ongaro] §4.2.1).
- **etcd learners** (since v3.4): "This learner node can neither vote nor count as quorum." "Leadership cannot be transferred to learner." It "rejects all requests other than serializable read and member status API" ([etcd][etcd-learner]).
- **CockroachDB non-voting replicas** "follow the Raft log (and are thus able to serve follower reads), but do not participate in quorum", for multi-region reads with "almost no impact on write latencies" ([CockroachDB][crdb-repl]).
- **Spanner** has three replica types. Read-write replicas vote and can lead. Read-only replicas "don't participate in voting" and serve reads. Witness replicas "vote whether to commit writes", "aren't eligible to become a leader", and "don't maintain a full copy of data" ([Spanner][spanner-repl]).
- **Witnesses in the literature.** Harp's witnesses "only participate in voting but do not normally participate in log replication"; Cheap Paxos is similar; "We think Raft could also support witnesses in a similar way" ([Ongaro][ongaro] §11.7.2).
- **DynamoDB MRSC** uses the same idea across Regions: three Regions, "three replicas, or … two replicas and one witness", and "You cannot perform read or write operations on a witness" ([DynamoDB][ddb-gt]).

### 3.3 Real systems on this shape

- **CockroachDB** runs one Raft group per range. "Each replica in a Raft group is either a 'leader' or a 'follower'", "a quorum of replicas agrees on any changes", it tolerates "(Replication factor - 1)/2" failures, and "the leaseholder is also the Raft group leader via the Leader leases mechanism" ([CockroachDB][crdb-repl]).
- **Spanner**: "Within each Paxos replica set, one replica is elected to act as the leader", and "The write is committed when a majority of voting replicas (or write quorum) agree" ([Spanner][spanner-repl]).
- **MySQL Group Replication** puts a Paxos-based group communication system under either one primary or many (§4.3). "For a transaction to commit, the majority of the group have to agree on the order", and on a partition "the system does not progress until this issue is resolved" ([MySQL 8.4][my-gr-bg]).

### 3.4 Kafka's ISR: primary-backup with an external membership service

Kafka is the instructive contrast. "Each partition in Kafka has a single leader and zero or more followers", and "Followers consume messages from the leader just as a normal Kafka consumer would". "Instead of majority vote, Kafka dynamically maintains a set of in-sync replicas (ISR)", and "with this ISR model and f+1 replicas, a Kafka topic can tolerate f failures without losing committed messages", where majority vote needs three copies to survive one failure. A replica that lags beyond `replica.lag.time.max.ms` or loses its controller session leaves the ISR. `acks=all` with `min.insync.replicas` sets durability. `unclean.leader.election.enable` lets an out-of-sync replica lead, trading committed data for uptime ([Kafka 4.4][kafka-design]). Ongaro's survey places this exactly: primary-backup "can recover from n − 1 failures (with the help of an external consensus service during recovery)" but "is not able to mask stragglers (slow servers) as well as consensus does" ([Ongaro][ongaro] §11.7.2, Table 11.2).

## 4. Several writers with leader links (multi-leader)

### 4.1 Link shapes and loops

Once more than one site accepts writes, each site's changes have to reach the others through the graph of replication links. The first-party docs show three shapes:

- **Ring.** NDB Cluster supports "circular replication between any number of clusters": 1 → 2 → 3 → 1. All SQL nodes must run with `log_replica_updates` so they forward what they receive ([NDB][ndb-circular]).
- **Star (fan-in).** MySQL multi-source replication lets "a replica … receive transactions from multiple immediate sources in parallel", one channel per source, for backup, shard merging or consolidation. It "does not implement any conflict detection or resolution" ([MySQL 8.4][my-multisource]).
- **Pairs and meshes.** CouchDB replication is one-way per task, and bidirectional sync means "two replication tasks in opposite direction" ([CouchDB][couch-intro]). "Any PouchDB object can replicate to any other PouchDB object" ([PouchDB][pouch-repl]). So any graph is buildable from pairs.

Forwarding creates loops. MySQL warns that `--replicate-same-server-id` with `--log-replica-updates` "can cause infinite loops in replication if the server is part of a circular replication topology", and that GTIDs prevent it "by skipping the execution of transactions that have already been applied". Every server needs a unique `server_id` across "the replication topology" ([MySQL 8.4][my-replica-opts]). PostgreSQL logical replication tags changes with an origin. A subscription with `origin = none` asks the publisher "to only send changes that don't have an origin", that is, local writes only ([PostgreSQL 18][pg-createsub]). Both are the same idea: a change carries where it came from, and a node does not take back or re-forward what it already has.

### 4.2 Ordering hazards

A single link with FIFO delivery preserves the sender's order. Two paths between the same pair of sites do not. The NDB docs say this directly for a three-cluster setup: "Because replication between NDB Clusters is asynchronous, there is no guarantee that Cluster 3's updates originating directly from Cluster 1 are more recent than those received through Cluster 2" ([NDB][ndb-circular]). In a ring, each write takes up to n−1 serial hops and every node on the way is a single point of failure for the writes behind it. In an all-to-all mesh, a write and a later write that depends on it can arrive at a third site in the wrong order.

Bayou is the early design that confronts both hazards. It accepts writes at any replica, propagates them by pairwise anti-entropy, and keeps two orders. Tentative writes are ordered by timestamp, with logical clocks advanced on receipt "to preserve the causal ordering of Write operations". A single primary commits: "one server designated as the primary takes responsibility for committing updates", and "knowledge of which Writes have committed and in which order … propagates to other servers during anti-entropy" ([Bayou][bayou] §5–6). Bayou prefers a primary over a majority because laptops "are mostly disconnected", and "the primary commit approach also enables updates to commit on a disconnected laptop that acts as the primary server".

### 4.3 Conflict handling as documented

| System                                 | Rule                                                                                                                                                                                                                                                                                                                                                                        |
| -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| MySQL Group Replication, multi-primary | Writesets are certified at row level. "The transaction that was ordered first commits on all servers, and the transaction ordered second aborts … a distributed first commit wins rule" ([summary][my-gr-summary]). Reads can be stale: "Group Replication is an eventual consistency system" unless `group_replication_consistency` is raised ([multi-primary][my-gr-mp]). |
| NDB Cluster circular                   | Per-table conflict functions. `NDB$MAX(col)` applies the greater timestamp. `NDB$EPOCH()` is asymmetric: "the primary NDB Cluster always wins any conflicts with the secondary" ([NDB][ndb-conflict]).                                                                                                                                                                      |
| PostgreSQL logical                     | No resolution. "If incoming data violates any constraints the replication will stop … it must be resolved manually." `update_origin_differs` is detected only with `track_commit_timestamp`, and "the update is always applied regardless of the origin of the local row" ([PostgreSQL 18][pg-conflicts]).                                                                  |
| DynamoDB global tables (MREC)          | "Last writer wins … the modification with the latest internal timestamp on a per-item basis" ([DynamoDB][ddb-gt]).                                                                                                                                                                                                                                                          |
| Cassandra                              | LWW per column, with timestamps "from a client clock or … from the coordinator node's clock", so "Cassandra's correctness does depend on these clocks" ([Cassandra][cass-dynamo]).                                                                                                                                                                                          |
| CouchDB                                | Keep both: "both versions exist on both sides". A winner is picked "using a deterministic algorithm so that the same choice will be made on all peers", and the app resolves `_conflicts` ([CouchDB][couch-conflicts]).                                                                                                                                                     |
| Dynamo                                 | Keep causally unrelated versions (vector clocks) and return them to the client "for semantic reconciliation", or use "last write wins" for services that accept it ([Dynamo][dynamo] §4.4, §6).                                                                                                                                                                             |
| Bayou                                  | Application-supplied dependency checks and merge procedures, run in the same order on every server ([Bayou][bayou] §4).                                                                                                                                                                                                                                                     |

Timestamp-based rules inherit every clock problem in [Hybrid Logical Clocks](hybrid-logical-clocks.md) §7.

### 4.4 Multi-region active-active

DynamoDB documents both ends in one product ([DynamoDB][ddb-gt]):

- **MREC** (default): every replica accepts writes; changes "are asynchronously replicated to all other replicas, typically within a second or less"; RPO equals "the replication delay". Conditional writes and transactions are evaluated in the local Region only, so "you might observe partially completed transactions" elsewhere. A strongly consistent read "may return stale data if the item was last updated in a different Region".
- **MRSC**: a write is "synchronously replicated to at least one other Region before the write operation returns", strongly consistent reads "always return the latest version", RPO zero. Concurrent cross-Region writes to one item fail with `ReplicatedWriteConflictException` and are retried, instead of being merged. Transactions are not supported.

Cassandra gets locality from quorums per datacenter: `LOCAL_QUORUM` guarantees reads "see the latest write from within the same datacenter", and `EACH_QUORUM` requires a majority in each ([Cassandra][cass-dynamo]).

## 5. Leaderless quorums (Dynamo style)

Dynamo's design principles are "Symmetry: Every node in Dynamo should have the same set of responsibilities as its peers" and "Decentralization", and its target is "an 'always writeable' data store where no updates are rejected due to failures or concurrent writes" ([Dynamo][dynamo] §2–3). The mechanisms (§4.5–4.8, read repair in §5):

- **N, R, W.** A key lives on the first N healthy nodes of its _preference list_. "R is the minimum number of nodes that must participate in a successful read … W … in a successful write. Setting R and W such that R + W > N yields a quorum-like system." Latency is "dictated by the slowest of the R (or W) replicas". The common setting is (3, 2, 2).
- **Sloppy quorum.** A strict quorum "would be unavailable during server failures and network partitions", so Dynamo uses "the first N healthy nodes from the preference list, which may not always be the first N nodes" on the ring. The paper does not spell out the consequence for R + W > N; my reading is that the overlap guarantee then holds only among the nodes that were actually reachable, until hinted handoff moves data back.
- **Hinted handoff.** A replica written to a stand-in node "will have a hint in its metadata that suggests which node was the intended recipient", and is delivered back when that node recovers. With W = 1, "the write request is only rejected if all nodes in the system are unavailable".
- **Read repair.** After a read, "if stale versions were returned in any of the responses, the coordinator updates those nodes with the latest version".
- **Anti-entropy with Merkle trees.** "Each node maintains a separate Merkle tree for each key range", and two nodes compare roots and descend only into differing branches. The cost is recomputation when key ranges change.
- **Membership by gossip.** "Each node contacts a peer chosen at random every second and the two nodes efficiently reconcile their persisted membership change histories."

Cassandra keeps the shape and changes the details. It describes itself as "Multi-master replication using versioned data and tunable consistency". It replaces vector clocks with per-column LWW ("formally … a Last-Write-Wins Element-Set"). It offers named consistency levels (`ONE`, `QUORUM`, `LOCAL_QUORUM`, `EACH_QUORUM`, `ALL`, `ANY`) instead of raw R and W. It calls read repair and hinted handoff "only best-effort", and relies on Merkle-tree repair, including sub-range and incremental repair, "to guarantee eventual consistency". "Write operations _are always sent to all replicas_, regardless of consistency level"; the level only sets how many acknowledgements the coordinator waits for ([Cassandra][cass-dynamo]).

## 6. Gossip, epidemics and peer meshes

Demers et al. compare three ways to spread an update to every site ([Demers et al.][demers], abstract and §1):

- **Direct mail:** the origin sends to every site. "Timely and reasonably efficient, but not entirely reliable", because sites do not always know every other site and mail is lost.
- **Anti-entropy:** "every site regularly chooses another site at random and by exchanging database contents with it resolves any differences". "Extremely reliable" but expensive, so it runs less often.
- **Rumor mongering:** a site with a "hot rumor" keeps sending it to random sites until too many already know it. Cheaper, with "some chance that an update will not reach all sites".

Their analysis of the tail favours pull. With pull, the fraction of still-susceptible sites goes p<sub>i+1</sub> = p<sub>i</sub><sup>2</sup>; with push it shrinks only by about e<sup>−1</sup> per round. Hence "when anti-entropy is used as a backup for some other distribution mechanism such as direct mail, either pull or push-pull is greatly preferable to push" (§1.3). Uniform partner choice "results in fairly high network traffic"; spatial distributions that favour nearby sites cut traffic on "critical links" such as the Xerox transatlantic link while converging nearly as fast. Deletion needs **death certificates**: removing a local copy fails because "the propagation mechanism will spread old copies of the item from elsewhere … back to the site where we have deleted it", and the certificates themselves can only be dropped safely once every site has them (§2).

Later work keeps the model. Scuttlebutt notes that updates "spread in expected time that grows logarithmic in the number of participating hosts" and that "push-pull is the most efficient style", then adds digests and flow control because a gossip channel has fixed capacity ([Scuttlebutt][scuttlebutt]). Every second, each Cassandra node gossips with a random live node, probabilistically with an unreachable one, and with a seed if the first pick was not one. UP/DOWN status is "local node decisions and … not propagated with gossip" ([Cassandra][cass-dynamo]). Bayou's anti-entropy needs only that "at most one pair of servers is ever connected at once" for every write to reach every server ([Bayou][bayou] §3).

A **peer mesh** is the deterministic cousin. Forwarding each message on first receipt to every neighbour is "eager reliable broadcast": robust to crashes, but "every message is sent O(n²) times in a group of n nodes" ([Kleppmann notes][kl-notes], Slide 82, secondary). Gossip replaces "every neighbour" with "a few random ones". That is the dial between the two.

## 7. Local-first and CRDT systems: star, relay, mesh

### 7.1 The star: authoritative server or store-and-forward relay

The local-first essay keeps servers but changes their job: "CRDTs do not require a peer-to-peer networking layer; using a server for communication is fine for CRDTs". Servers act "not as central authorities, but as 'cloud peers' that support client applications without being on the critical path", for example "a cloud peer that stores a copy of the document, and forwards it to other peers when they come online", which solves peers that are never online at the same time ([Kleppmann et al.][lfs] §4.2.4). The Yjs paper likewise says Yjs "can be used with multiple communication protocols, including P2P, federated or client-server" ([YATA][yata] §1). Which star servers merge, relay, or decide is mapped in [Local-first web architecture](local-first-architecture.md) §2. Here the interest is how each forwards.

- **y-websocket** "implements a classical client server model. Clients connect to a single endpoint over Websocket. The server distributes awareness information and document updates among clients" ([README][y-ws-readme]). The client applies remote updates with the provider as transaction origin ([`y-websocket.js:40-45`][y-ws-read]) and sends only updates whose `origin !== this`, so it never echoes the server's own messages back. A comment on the awareness handler states the rule: "We must not echo them back - every peer receives them from the source" ([`y-websocket.js:476-511`][y-ws-origin]).
- **Automerge Repo** makes the server a full `Repo`. `DocHandle.update` "is called any time we have a new document state; could be from a local change, a remote change, or a new document from storage" ([`DocHandle.ts:380-389`][am-handle-update]). Any update that moves the heads dispatches a change ([`Document.ts:74-93`][am-document]), and the doc synchronizer then marks "all active peers dirty — we have new data to send" ([`DocSynchronizer.ts:169-178`][am-docsync]). So a server forwards because it holds and merges the document, and each peer pair runs its own sync state. A `ShareConfig.announce` policy controls who is offered what: "a tab connected to a sync server might want to announce every document to the sync server, but the sync server would not want to announce every document to every connected peer" ([`Repo.ts:909-920`][am-shareconfig]).
- **CouchDB/PouchDB** run the star as pairwise replications to a central CouchDB, with "many local PouchDBs mirroring to a single remote CouchDB" as a documented pattern ([PouchDB][pouch-repl]).

### 7.2 The mesh

- **y-webrtc** "Propagates document updates peer-to-peer to all users using WebRTC" and is "Not suited for a large amount of collaborators on a single document (each peer is connected to each other)". Peers find each other through signaling servers. Each peer connects to at most "`20 + math.floor(random.rand() * 15)` peers", where the random factor is there "to prevent clients to form clusters", and "the clients will still sync if every client is connected at least indirectly to every other client". Same-browser tabs use `BroadcastChannel` instead of WebRTC ([README][y-webrtc-readme]). Indirect sync works because the update handler re-broadcasts every document update to all connections whatever its origin ([`y-webrtc.js:259-265, 347-352`][y-webrtc-update]). The flood stops because Yjs emits `update` only when a transaction actually added content ([`Transaction.js:318-327`][yjs-hascontent]). That is eager reliable broadcast (§6) with idempotent merge as the duplicate filter.
- **Practicality.** The essay's verdict on P2P in its prototypes: "NAT traversal … is unreliable depending on the particular router or network topology", and peers that are not online together "cannot connect to each other" ([Kleppmann et al.][lfs] §4.2.4).

### 7.3 What each CRDT style needs from the topology

Shapiro et al. state the requirements:

- **State-based:** "Every replica occasionally sends its local state to some other replica, which merges the state … every update eventually reaches every replica, either directly or indirectly." It works over "a fully connected communication graph, where every arc is a fair-lossy channel", and the authors point at "gossip or anti-entropy approaches" as known delivery mechanisms.
- **Op-based:** "We assume an underlying reliable causally-ordered broadcast communication protocol, i.e., one that delivers every message to every recipient exactly once and in an order consistent with happened-before."

Their conclusion: "Assuming only that the communication subsystem ensures eventual delivery (in causal order for op-based objects), CRDTs are guaranteed to converge" ([Shapiro et al.][shapiro] §2.1, §2.4, §7). Delta-state CRDTs sit between the two: "delta-groups can be shipped using an unreliable dissemination layer that may drop, reorder, or duplicate messages" when only convergence is wanted, and can be "subsumed by a less frequent sending of the full state". The anti-entropy algorithm has a "transitive mode", which forwards deltas received from others, and a "direct mode", where a node ships only its own deltas, and the authors leave the choice to "network topology" among other criteria. Causal consistency needs delta-intervals and the "causal delta-merging condition" ([Almeida et al.][delta] §4–6; details in [CRDT deltas](crdt-deltas.md) §6).

Put against the topologies:

| CRDT style  | Star with one relay that forwards in arrival order over FIFO links                                                                                                                | Star plus a second path (tab channel, P2P), or a flooding mesh                                                                                                                           | Gossip / random anti-entropy                        |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| Op-based    | Order is satisfied: a single relay is the sequencer of total order broadcast ([Kleppmann notes][kl-notes] Slide 86, secondary). Exactly-once still needs dedup across reconnects. | Not satisfied by the network. Replicas must hold back ops until causally ready and drop duplicates: Yjs `pendingStructs`, Automerge's change queue ([CRDT deltas](crdt-deltas.md) §5–6). | Same as the middle column.                          |
| State-based | Only eventual delivery is needed. Any order, duplicates and loss are fine.                                                                                                        | Same. The topology only changes cost.                                                                                                                                                    | The native fit; Shapiro et al. name gossip.         |
| Delta-state | Convergence over any of them. Causal consistency needs delta-intervals, acks per neighbour, and a durable delta counter ([CRDT deltas](crdt-deltas.md) §8).                       | Transitive mode forwards deltas from others; direct mode needs a link between every pair that must exchange.                                                                             | As state-based, with full-state rounds as backstop. |

The first cell is a derivation from the cited definitions, not a quoted claim: if every op passes through one relay that forwards over per-recipient FIFO links in its own receive order, every recipient sees the relay's single order, and an op sent after delivering another reaches the relay after it. It holds only if the uplink is FIFO too, and only while the relay is the sole path.

## 8. Comparison

Messages are counted per write among n replicas, ignoring acknowledgements unless they gate the reply.

| Topology                                            | Who accepts writes         | A write waits for                            | Best consistency it can give                                           | During a partition                                                                              | Conflicts                                          | Messages per write; latency                              |
| --------------------------------------------------- | -------------------------- | -------------------------------------------- | ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | -------------------------------------------------- | -------------------------------------------------------- |
| Primary-backup, async                               | leader                     | leader only                                  | linearizable at the leader; followers lag; failover loses the lag      | leader side writes; the rest serves stale reads                                                 | none                                               | n−1; one local commit                                    |
| Primary-backup, sync or quorum-sync (PG `ANY k`)    | leader                     | k standbys at the chosen level               | no acknowledged-write loss; standby reads fresh with `remote_apply`    | leader side writes only while k standbys answer; PG blocks, MySQL semi-sync falls back to async | none                                               | n−1; slowest of the k                                    |
| Cascading tree                                      | leader                     | leader (PG cascading is async only)          | as async, staleness grows with depth                                   | subtrees below a cut go stale                                                                   | none                                               | n−1 in total, ≤ fan-out per node; depth hops             |
| Chain / CRAQ                                        | head                       | tail                                         | strong; CRAQ reads clean versions anywhere                             | needs the master (Paxos-replicated) to reconfigure; CRAQ offers eventual reads                  | none                                               | n−1 serial; sum of hop latencies                         |
| Consensus (Raft, Multi-Paxos)                       | elected leader             | majority                                     | linearizable (log, ReadIndex or lease)                                 | majority side only                                                                              | none                                               | n−1; median of the round trips                           |
| Primary-backup with external membership (Kafka ISR) | leader                     | all ISR members, ISR ≥ `min.insync.replicas` | committed messages survive f failures with f+1 copies                  | stalls below `min.insync.replicas` unless unclean election is allowed                           | none                                               | n−1; slowest ISR member                                  |
| Multi-leader, ring / star / all-to-all              | every leader               | local site                                   | eventual; per-link FIFO at best, multi-path reordering                 | every side keeps writing                                                                        | LWW, designated winner, certification, or keep all | ring n−1 serial; star 2 hops; mesh n−1 direct            |
| Group Replication, multi-primary                    | every member               | majority-ordered certification               | conflicting transactions abort; reads may be stale                     | minority stops                                                                                  | first committer wins                               | n−1; one ordering round                                  |
| Leaderless quorum (Dynamo, Cassandra)               | any of N via a coordinator | W of N (sloppy in Dynamo)                    | read-your-writes when R + W > N and quorums are strict                 | always writeable with sloppy quorum and hints                                                   | vector clocks and client merge, or LWW             | N sent (Cassandra: always all); slowest of W             |
| Gossip / anti-entropy                               | any site                   | local site                                   | eventual                                                               | each side converges internally, then across                                                     | data type or LWW; death certificates for deletes   | O(log n) rounds; push-pull per round                     |
| CRDT star, merging or relaying server               | every client               | local replica                                | strong eventual consistency; causal order free with one in-order relay | every client keeps writing; the server is not on the write path                                 | merge (data type)                                  | 1 up, n−1 down with origin filtering (y-websocket)       |
| CRDT peer mesh                                      | every peer                 | local replica                                | strong eventual consistency                                            | every component keeps writing; needs signaling and NAT traversal to form                        | merge                                              | n−1 direct; up to n(n−1) with re-broadcast               |
| **`@goodstate` today** (§9)                         | every tab                  | local replica                                | strong eventual consistency for clients; the server copy can regress   | every tab keeps writing; tabs of one origin keep syncing with each other                        | merge: LWW registers and maps, RGA with tombstones | **measured: n uploads and n² downloads of a whole root** |

## 9. Where `@goodstate` sits

Everything here was read from the working tree at `79bcd03` (2026-11-18). The example server is `apps/example-server`, which is example code, not a published package.

### 9.1 The topology as built

**Write acceptance: every replica.** Each `Store` is a full replica of state-based CRDT roots: `LWWRegister`, `LWWMap`, and `RGA` with permanent tombstones ([ADR-19][adr19]). Timestamps carry a replica identity so that LWW ties break the same way everywhere ([ADR-09][adr09]). Local writes never wait for anything, so the system is leaderless and multi-writer in the sense of §5–7.

**Links per tab.** The example app wires three engines into every tab ([`apps/example-react/src/store.ts:9-20`][nn-app-store]):

- `SseSync`: an `EventSource` on `/subscribe` for downstream, and one `fetch` POST per changed field for upstream ([`sse-sync.ts:41`][nn-sse]). This is a star around the server.
- `BroadcastSync`: `postMessage` of each changed field to every other same-origin tab ([`broadcast-sync.ts:30-33`][nn-bc]). This is an all-to-all mesh among tabs.
- `IndexDbSync`: `put` of each changed field into one IndexedDB that all tabs of the origin share ([`index-db-sync.ts:30-35`][nn-idbsync]). This is a second hub, local and persistent.

**The server stores and replaces.** `POST /push` runs `db.update(data)` and then `bus.publish(data)` ([`routes/sync.ts:14-23`][nn-server]). `update` is `Object.assign` in memory or `HSET` in Redis ([`memory-database.ts:9`][nn-memdb], [`redis-database.ts:37`][nn-redisdb]). `GET /subscribe` sends the stored map as the first event, then every published push ([`routes/sync.ts:33-55`][nn-server]). In §7.1's terms it is a store-and-forward relay, but one that keeps only the last value pushed per field, not the join. ADR-15 says so: "The example server stores each field as it arrives and doesn't merge" ([ADR-15][adr15]).

**Propagation: flooding without origin tags.** `SyncEngine.receive` calls `store.merge` for each field ([`sync-engine.ts:102-107`][nn-engine]). `Store.merge` runs inside `commit`, which notifies `onChange` whenever an entity changed ([`store.ts:61-106`][nn-store]). Every connected engine subscribes to `onChange` and pushes every changed field ([`sync-engine.ts:38-45`][nn-engine]). Nothing records which engine delivered a change, so a merge that changed local state is pushed on every link, including back to the server it came from. ADR-16 makes this deliberate: "The example server stores each pushed field as it arrives and doesn't merge, so a client that merges a pull and ends up with something new has to push the result back" ([ADR-16][adr16]).

**Anti-entropy on connect.** Each connection pulls every field and merges it, then pushes every field ([ADR-16][adr16]; [`sync-engine.ts:17-45`][nn-engine]). In Demers' terms, live pushes are direct mail and each (re)connect is one push-pull anti-entropy exchange with the server. ADR-17 leaves the retry schedule to the app ([ADR-17][adr17]).

### 9.2 Probe: fan-out of one edit

A scratch Vitest file outside the repo (no repository file changed) attached n stores to an in-memory hub that mimics the example server: store each pushed field, publish it to every subscriber including the sender. A second variant also connected all n stores through a `BroadcastChannel` stand-in. One store then added one row, and the probe counted messages until quiescent:

| Setup                   | n   | Server pushes | SSE events | Channel posts | Channel deliveries | Converged |
| ----------------------- | --- | ------------- | ---------- | ------------- | ------------------ | --------- |
| server only             | 2   | 2             | 4          |               |                    | yes       |
| server only             | 4   | 4             | 16         |               |                    | yes       |
| server only             | 8   | 8             | 64         |               |                    | yes       |
| server only             | 16  | 16            | 256        |               |                    | yes       |
| server and tabs channel | 4   | 4             | 16         | 4             | 12                 |           |
| server and tabs channel | 8   | 8             | 64         | 8             | 56                 |           |

Each replica pushes exactly once: the editor, plus one echo from each other replica, because its first merge changes its state and later merges are no-ops. Every push is published to all n subscribers. So one edit costs **n uploads and n² downloads of the whole encoded root** (which for an `RGA` includes every row and every tombstone). Adding the tab channel adds n posts and n(n−1) deliveries, and does not reduce server traffic, because each tab still has its own server connection. The probe delivers in order on microtasks. It does not model reordered POSTs, which is where the server copy can regress ([Local-first web architecture](local-first-architecture.md) §8.2).

### 9.3 Classification

- **Write model:** leaderless, every replica writes, conflicts resolved by the data types. Closest to §7's CRDT star, with a non-merging relay, plus a same-origin mesh.
- **Delivery requirements:** met. State-based roots need only eventual delivery (§7.3), so two paths (server and `BroadcastChannel`), duplicates, and out-of-order POSTs are harmless to client convergence. This is why `@goodstate` can mix a star and a mesh without the causal buffering that Yjs and Automerge need.
- **Ordering the network gives:** downstream is FIFO (one SSE stream). Upstream is not: each push is a separate POST, and ADR-16 notes that "two pushes of one field can also arrive out of order" ([ADR-16][adr16]). The relay therefore is not a sequencer, which does not matter for state-based merge but does matter for the stored copy.
- **Fan-out:** eager re-broadcast (§6), with idempotent merge as the duplicate filter, as in y-webrtc (§7.2). y-websocket avoids the echo with an origin check; `@goodstate` cannot drop its echo without first changing the server, because the echo is how the server's copy reaches the join.
- **Deletes:** RGA tombstones are Demers' death certificates. ADR-19 accepts unbounded growth and has not "defined when it would be safe to drop one" ([ADR-19][adr19]). Demers' answer is that a certificate can go once every site has it, and with an open, unknown set of clients nothing can establish that.

### 9.4 What the topology research suggests

These are observations, not decisions. Each would need an ADR.

1. **Make the server a merging peer, then filter by origin.** If the server decoded, merged and stored the join (as Automerge Repo's server does, §7.1), its copy could not regress, and clients could stop echoing what came from the server. Per edit, traffic would drop from n up and n² down to 1 up and n down, which is y-websocket's shape. The two changes only work together: filtering echoes against today's replacing server would leave the server holding whichever concurrent push arrived last. The alternative without decoding on the server is an append-only set of pushed states joined on read, as in [Local-first web architecture](local-first-architecture.md) §8.3.
2. **Ship less than a whole root.** The n² term multiplies the size of one root. Deltas or per-row records shrink every term in §9.2; the options are in [CRDT deltas](crdt-deltas.md) §8. Moving to deltas brings §7.3's delta-state requirements: convergence stays free, causal consistency does not.
3. **One server connection per origin.** Every tab opens its own stream and pushes everything on connect, so k tabs multiply server traffic by k on top of the tab channel. A Web Lock-elected owner that holds the single server connection, with other tabs fed over `BroadcastChannel`, turns the per-origin topology into a tree. The multi-tab patterns are in [Local-first web architecture](local-first-architecture.md) §5.3.
4. **Peer-to-peer stays open.** Because the wire unit is state-based, a WebRTC engine would converge without new delivery guarantees. y-webrtc's limits (connection caps, signaling servers, NAT traversal, §7.2) and the n² flood cost of whole roots are the obstacles, not correctness.
5. **The clock still matters for LWW across writers.** Every replica writes, so LWW correctness rests on [ADR-09][adr09]'s replica tiebreak and on the receive rule that ADR-09 says is still missing ([Hybrid Logical Clocks](hybrid-logical-clocks.md) §9).

---

## 10. What I could not verify

These were looked for and not found in a primary source, or were found only in a secondary one. They are not stated as fact above.

**Topology naming**

- The "circular, star, all-to-all" taxonomy of multi-leader topologies is usually credited to _Designing Data-Intensive Applications_, ch. 5. I did not read the book for this note. §4 builds the same picture from MySQL and PostgreSQL docs instead, and the ordering hazard rests on the NDB statement about multiple paths.
- Kleppmann's lecture notes are teaching material and are used as a secondary source for the broadcast hierarchy and the O(n²) eager broadcast cost.

**Papers**

- The Demers et al. scan has poor OCR. The quoted sentences and the p<sub>i+1</sub> = p<sub>i</sub><sup>2</sup> recurrence for pull were readable. The exact push recurrence and the numeric tables were not checked digit by digit.
- The 2018 JPDC version of the delta-state paper was not re-read. The arXiv v1 definitions match what [CRDT deltas](crdt-deltas.md) quotes from JPDC.
- The first cell of the §7.3 table (one in-order relay gives causal order) is my derivation from the cited definitions plus the lecture notes' sequencer construction, not a claim from a paper.

**Systems**

- **Cassandra**: the website refused connections, so the docs were read from the trunk source (`base.version` 7.0). Whether the published docs for a released version say the same was not checked. Accord transactions in trunk were not covered.
- **MySQL**: the default `rpl_semi_sync_source_wait_point` value names (`AFTER_SYNC`, `AFTER_COMMIT`) did not appear in the fetched page text, so only the behaviour is quoted. What Group Replication does on loss of quorum beyond "does not progress" was not read.
- **PostgreSQL**: whether a hot standby rejects writes was not read from §26.4. Whether `origin = none` fully prevents loops in bidirectional logical replication is not stated in the pages read.
- **CouchDB**: the docs page did not show a version, and it does not describe the winning-revision algorithm itself, only that it is deterministic.
- **CockroachDB**: what a range does after losing quorum was not on the page read.
- **Kafka**: the formal definition of "committed" sits in the delivery semantics section, which was not read; §3.4 uses only the replication section.
- **Automerge Repo**: the automerge.org networking page does not use the words "sync server" or "peer" for the server role; §7.1's description of the server as a forwarding peer comes from the code, not the docs.
- **Yjs docs**: the connection provider page on docs.yjs.dev returned only one sentence, so nothing is quoted from it.

**This repo**

- The §9.2 probe used an in-memory hub with ordered microtask delivery. It did not exercise real HTTP, real `BroadcastChannel`, IndexedDB, or reordered POSTs. Counts on a real deployment will add the IndexedDB writes and depend on timing.
- Whether a server that merges plus origin filtering in `SyncEngine` closes every regression window was reasoned about, not tested.

---

## References

[chain]: https://www.usenix.org/legacy/events/osdi04/tech/full_papers/renesse/renesse.pdf
[craq]: https://www.usenix.org/legacy/event/usenix09/tech/full_papers/terrace/terrace.pdf
[dynamo]: https://www.allthingsdistributed.com/files/amazon-dynamo-sosp2007.pdf
[paxos]: https://lamport.azurewebsites.net/pubs/paxos-simple.pdf
[raft]: https://raft.github.io/raft.pdf
[ongaro]: https://web.stanford.edu/~ouster/cgi-bin/papers/OngaroPhD.pdf
[bayou]: https://people.eecs.berkeley.edu/~brewer/cs262b/update-conflicts.pdf
[demers]: https://none.cs.umass.edu/~shenoy/courses/fall04/readings/demers.pdf
[scuttlebutt]: https://www.cs.cornell.edu/home/rvr/papers/flowgossip.pdf
[shapiro]: ../../papers/CRDTs_SSS-2011.pdf
[delta]: https://arxiv.org/abs/1603.01529
[lfs]: ../../papers/local-first.pdf
[yata]: ../../papers/GROUP2016.pdf
[kl-notes]: https://www.cl.cam.ac.uk/teaching/2122/ConcDisSys/dist-sys-notes.pdf
[pg-standby]: https://www.postgresql.org/docs/18/warm-standby.html
[pg-wal]: https://www.postgresql.org/docs/18/runtime-config-wal.html#GUC-SYNCHRONOUS-COMMIT
[pg-logical]: https://www.postgresql.org/docs/18/logical-replication.html
[pg-conflicts]: https://www.postgresql.org/docs/18/logical-replication-conflicts.html
[pg-createsub]: https://www.postgresql.org/docs/18/sql-createsubscription.html
[my-semisync]: https://dev.mysql.com/doc/refman/8.4/en/replication-semisync.html
[my-binlog-opts]: https://dev.mysql.com/doc/refman/8.4/en/replication-options-binary-log.html#sysvar_log_replica_updates
[my-replica-opts]: https://dev.mysql.com/doc/refman/8.4/en/replication-options-replica.html
[my-multisource]: https://dev.mysql.com/doc/refman/8.4/en/replication-multi-source.html
[my-gr-bg]: https://dev.mysql.com/doc/refman/8.4/en/group-replication-background.html
[my-gr-summary]: https://dev.mysql.com/doc/refman/8.4/en/group-replication-summary.html
[my-gr-mp]: https://dev.mysql.com/doc/refman/8.4/en/group-replication-multi-primary-mode.html
[ndb-circular]: https://dev.mysql.com/doc/refman/8.4/en/mysql-cluster-replication-multi-source.html
[ndb-conflict]: https://dev.mysql.com/doc/refman/8.4/en/mysql-cluster-replication-conflict-resolution.html
[cass-dynamo]: https://github.com/apache/cassandra/blob/53c3561e9db3fa0b1ed8e29ce462fde6ce566ff0/doc/modules/cassandra/pages/architecture/dynamo.adoc
[ddb-gt]: https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/V2globaltables_HowItWorks.html
[crdb-repl]: https://docs.cockroachlabs.com/docs/stable/architecture/replication-layer
[etcd-learner]: https://etcd.io/docs/v3.6/learning/design-learner/
[kafka-design]: https://kafka.apache.org/44/design/design/
[spanner-repl]: https://docs.cloud.google.com/spanner/docs/replication
[couch-intro]: https://docs.couchdb.org/en/stable/replication/intro.html
[couch-conflicts]: https://docs.couchdb.org/en/stable/replication/conflicts.html
[pouch-repl]: https://pouchdb.com/guides/replication.html
[am-net-doc]: https://automerge.org/docs/reference/repositories/networking/
[yjs-updates]: https://docs.yjs.dev/api/document-updates
[y-ws-readme]: https://github.com/yjs/y-websocket/blob/c20c7425ef24f25bd4e15490546a009912c83fb2/README.md
[y-ws-read]: https://github.com/yjs/y-websocket/blob/c20c7425ef24f25bd4e15490546a009912c83fb2/src/y-websocket.js#L40-L45
[y-ws-origin]: https://github.com/yjs/y-websocket/blob/c20c7425ef24f25bd4e15490546a009912c83fb2/src/y-websocket.js#L476-L511
[y-webrtc-readme]: https://github.com/yjs/y-webrtc/blob/c411f1d7223b68f3c6fc9c5901a19819a17db667/README.md
[y-webrtc-update]: https://github.com/yjs/y-webrtc/blob/c411f1d7223b68f3c6fc9c5901a19819a17db667/src/y-webrtc.js#L259-L352
[yjs-hascontent]: https://github.com/yjs/yjs/blob/ee37f0a0e23a7c3e14531bae335d439e54c743e6/src/utils/Transaction.js#L318-L327
[am-handle-update]: https://github.com/automerge/automerge-repo/blob/6e2101acbf1151cf35d6bd17b7dc61a6384fc828/packages/automerge-repo/src/DocHandle.ts#L380-L389
[am-document]: https://github.com/automerge/automerge-repo/blob/6e2101acbf1151cf35d6bd17b7dc61a6384fc828/packages/automerge-repo/src/Document.ts#L74-L93
[am-docsync]: https://github.com/automerge/automerge-repo/blob/6e2101acbf1151cf35d6bd17b7dc61a6384fc828/packages/automerge-repo/src/synchronizer/DocSynchronizer.ts#L169-L178
[am-shareconfig]: https://github.com/automerge/automerge-repo/blob/6e2101acbf1151cf35d6bd17b7dc61a6384fc828/packages/automerge-repo/src/Repo.ts#L909-L920
[nn-store]: ../../../packages/store/src/store.ts
[nn-engine]: ../../../packages/sync-engine/src/sync-engine.ts
[nn-sse]: ../../../packages/sse-sync/src/sse-sync.ts
[nn-bc]: ../../../packages/broadcast-sync/src/broadcast-sync.ts
[nn-idbsync]: ../../../packages/indexdb-sync/src/index-db-sync.ts
[nn-server]: ../../../apps/example-server/src/routes/sync.ts
[nn-memdb]: ../../../apps/example-server/src/services/database/memory-database.ts
[nn-redisdb]: ../../../apps/example-server/src/services/database/redis-database.ts
[nn-app-store]: ../../../apps/example-react/src/store.ts
[adr09]: ../../decisions/ADR-09-stamp-times-with-a-replica-identity.md
[adr15]: ../../decisions/ADR-15-stream-remote-changes-over-server-sent-events.md
[adr16]: ../../decisions/ADR-16-give-sync-engines-a-connection-lifecycle.md
[adr17]: ../../decisions/ADR-17-retry-disconnected-engines-on-wake-signals.md
[adr19]: ../../decisions/ADR-19-tombstone-removed-rows.md
