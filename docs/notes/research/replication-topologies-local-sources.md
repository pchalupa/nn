# Replication topologies: local source map

Research date: 2026-11-22.

Companion to [Replication topologies](replication-topologies.md). Section numbers below refer to that note unless explicitly attached to a source. This map records evidence from local PDFs, including qualifications worth carrying into a future revision.

PDF pages are one-based viewer positions; printed pages are the labels inside the document. The CRDT PDF has a HAL cover, so PDF page = manuscript page + 1. YATA is an unnumbered author preprint; its locators use PDF pages only.

## Existing references with stale filenames

These are already cited in the note, not new sources. All three old paths are missing locally.

| Existing reference                | Correct local file                                                                 |
| --------------------------------- | ---------------------------------------------------------------------------------- |
| `[shapiro]`: `CRDTs_SSS-2011.pdf` | [Conflict-free Replicated Data Types.pdf][crdt]                                    |
| `[lfs]`: `local-first.pdf`        | [Local-First Software - You Own Your Data, in Spite of the Cloud.pdf][local-first] |
| `[yata]`: `GROUP2016.pdf`         | [Near Real-Time Peer-to-Peer Shared Editing on Extensible Data Types.pdf][yata]    |

## Primary sources

### Shapiro et al., Conflict-free Replicated Data Types (SSS 2011)

**Already cited; strongest match for §§7.3, 8 and the assumptions behind §9.3.**

| Source section and locator                                         | Evidence and use                                                                                                                                                                                                                                                                           |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| §2.1 “State-based object,” manuscript p. 3 / PDF p. 4              | Replicas exchange state and merge it; updates reach replicas directly or indirectly. Names gossip and anti-entropy, then assumes a fully connected graph with fair-lossy channels and repeated state sending. Supports the state-based delivery discussion in §7.3.                        |
| §§2.2–2.3, manuscript pp. 4–5 / PDF pp. 5–6                        | Defines strong eventual consistency and the monotonic join-semilattice condition. Merge is associative, commutative and idempotent. Theorem 1 still requires eventual delivery and termination. Supports tolerance of reordering and duplicates, not permanent loss of an update's effect. |
| §2.4, manuscript pp. 5–6 / PDF pp. 6–7                             | Explicitly assumes reliable causal broadcast delivering each message exactly once. Theorem 2 also requires concurrent operations to commute and delivery preconditions to be satisfied. Supports the op-based row of §7.3.                                                                 |
| §3.1, manuscript p. 6 / PDF p. 7; §7, manuscript p. 14 / PDF p. 15 | Communicating subsets can converge during partitions; the conclusion restates eventual delivery, with causal delivery for op-based objects. Supports availability/convergence comparisons in §8.                                                                                           |

**Limits:** these are sufficient conditions under the paper's model, including non-Byzantine processes and crash recovery with memory intact (§2, manuscript p. 2 / PDF p. 3). “Op-based needs causal broadcast” describes this construction, not a universal lower bound for every operation-based design. The paper does not verify `@nn`'s delivery mechanism or a replacing server's stored state.

### Kleppmann et al., Local-First Software (Onward! 2019)

**Already cited; direct support for §§7.1–7.2.**

All relevant passages are in §4.2.4 “Findings”:

| Printed / PDF pages                                                                             | Evidence and use                                                                                                                                                                                                                           |
| ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| p. 173 / p. 20, “Network communication remains an unsolved problem”                             | CRDTs merge data but do not transport it. Explicitly says a server is acceptable; reports unreliable NAT traversal in the prototypes. Supports separating merge semantics from network topology.                                           |
| p. 173 / p. 20, “Cloud servers still have their place for discovery, backup, and burst compute” | Peers that are never online together cannot connect directly. A “cloud peer” stores a document and forwards it when others return, without being on the client's critical path. This is the exact source for §7.1's closed-laptop example. |
| pp. 172–173 / pp. 19–20, “CRDTs accumulate a large change history”                              | Reports storage/performance costs and difficulty truncating history when a collaborator may return after six months. Relevant background for §9.3's metadata-retention problem.                                                            |

**Limits:** these are 2019 prototype findings and design guidance, not a transport specification or current Automerge performance assessment. They do not establish that a relay must merge, or validate replacing a stored state with the last arrival.

### Nicolaescu et al., Near Real-Time Peer-to-Peer Shared Editing on Extensible Data Types (GROUP 2016)

**Already cited; confirms §7.1 and adds historical sync/retention context.**

| Source section / PDF pages                                | Evidence and use                                                                                                                                                                                                                                                                  |
| --------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| §1, p. 2                                                  | Explicitly says Yjs supports “P2P, federated or client-server” communication. This is the note's existing topology quotation.                                                                                                                                                     |
| §3 opening, p. 3; §3.6 “Offline Editing Support,” pp. 6–7 | Targets intermittent connections and random message arrival. Reconnection exchanges state vectors and missing operations; operations are sent in their original order and form to make them integrable. Relevant to §7.3's distinction between receiving and applying operations. |
| §3.5 “Garbage Collection,” p. 6                           | Uses a configurable fixed delay, assuming all users received a deletion. Explicitly warns that this collector may break late joining when offline users still reference removed operations. Relevant to §9.3's tombstone discussion.                                              |

**Limits:** this describes the 2016 algorithm and implementation. It does not verify today's `pendingStructs`, provider origin filtering, WebRTC connection limits or rebroadcast behavior; those remain source-code claims in the original note. Its timeout-based collection is not a general safe-deletion rule for arbitrarily disconnected replicas.

### Roh et al., [Replicated Abstract Data Types: Building Blocks for Collaborative Applications][radt] (JPDC 2011)

**New primary addition; strongest use is §§7.3 and 9.3, rather than a topology taxonomy.**

| Source section and locator                                                   | Evidence and use                                                                                                                                                                                                                                                                                                                       |
| ---------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| §§2.1–2.2, printed p. 355 / PDF p. 2; Algorithm 1, printed p. 356 / PDF p. 3 | Local operations execute immediately and broadcast; remote operations wait in a queue until vector clocks show causal readiness. Gives a concrete primary-source example of buffering below an optimistic replicated data type.                                                                                                        |
| §5.1, printed p. 360 / PDF p. 7                                              | Sessions start with identical replica structures and initial vector clocks; membership changes advance a global session number. These assumptions matter when interpreting its reclamation scheme.                                                                                                                                     |
| §5.6 “Cobject preservation,” printed pp. 363–364 / PDF pp. 10–11             | Tombstones preserve objects referenced by delayed operations. Safe RGA purging uses per-site vector-clock knowledge and two conditions: all sites have executed the deletion, plus an ordering condition protecting the next node used as an insertion reference. Merely knowing that everyone saw the deletion is not the whole rule. |
| §5.6, printed p. 364 / PDF p. 11; §7, printed pp. 365–366 / PDF pp. 12–13    | A paused site can block purging until its clock is obtained. Causal delivery can also delay unrelated operations; relaxing causality for RGAs requires algorithm changes and is left as future work.                                                                                                                                   |

**Limits:** the paper presents operation-based RADTs with explicit membership/session assumptions. It is not a proof of `@nn`'s state-based RGA, nor a ready-made collector for an unknown set of offline clients.

## New secondary sources

These books explain protocols and point to original work; they remain secondary evidence.

### Kleppmann, [Designing Data-Intensive Applications][ddia], first edition (March 2017)

| Source section and locator                                                                                     | Mapping to the note                                                                                                                                                                                                                                                                         |
| -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Ch. 5, “Multi-Leader Replication Topologies,” printed pp. 175–177 / PDF pp. 197–199, Figures 5-8 and 5-9       | Directly fills §10's unread-book gap: circular, star and all-to-all; stars generalize to trees; forwarding identifiers prevent loops; failed intermediate nodes disrupt paths; multiple paths can deliver an update before its insert. Timestamps alone do not solve that ordering problem. |
| Ch. 5, printed pp. 152–155 / PDF pp. 174–177; pp. 168–174 / PDF pp. 190–196                                    | Supporting explanations for §2's synchronous/asynchronous replication and §4's multi-leader, offline and collaborative-editing cases.                                                                                                                                                       |
| Ch. 5, leaderless replication, printed pp. 177–184 / PDF pp. 199–206; especially pp. 181–184 / PDF pp. 203–206 | Qualifies §§5 and 8: sloppy quorums can lose guaranteed read/write overlap entirely. Even strict `R + W > N` alone does not guarantee read-your-writes under the implementation edge cases discussed on printed p. 182.                                                                     |
| Ch. 9, total order broadcast, printed pp. 348–352 / PDF pp. 370–374; consensus, pp. 364–370 / PDF pp. 386–392  | Supports §§1 and 3's ordering discussion while distinguishing a sequencer from reliable delivery and fault-tolerant leader replacement. A manually selected leader is not fault-tolerant consensus.                                                                                         |

### Vitillo, [Understanding Distributed Systems][uds], second edition (March 2022)

| Source section and locator                                                               | Mapping to the note                                                                                                                                                                                                                          |
| ---------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Ch. 10 §§10.1–10.3, printed pp. 78–90 / PDF pp. 96–108                                   | State-machine replication and consensus background for §§1 and 3.                                                                                                                                                                            |
| Ch. 10 §10.4, printed pp. 90–94 / PDF pp. 108–112                                        | Chain replication, CRAQ and control/data-plane separation for §2.3. Footnote 22 on printed p. 90 identifies its backward-acknowledgment/head-reply path as the CRAQ variant; do not substitute it for the original chain paper's tail reply. |
| Ch. 11 §11.1, printed pp. 96–98 / PDF pp. 114–116                                        | Best-effort broadcast, eager reliable broadcast's `N²` message cost, randomized gossip and total order. A local complement to the Cambridge notes used in §§1, 6 and 9.                                                                      |
| Ch. 11 §11.2, printed pp. 98–102 / PDF pp. 116–120; §11.3, pp. 103–105 / PDF pp. 121–123 | CRDTs, anti-entropy, LWW/multi-value registers, and Dynamo. Explains why quorum overlap alone does not imply linearizability, plus read repair and background Merkle-tree synchronization. Relevant to §§4–7.                                |

## Qualifications for a future revision

- **§5 sloppy quorums:** replace the interpretation “overlap among reachable nodes” with a conditional statement about actual replica-set intersection. Reachability and `R + W > N` alone do not establish it.
- **§8 quorum row:** qualify the strict-quorum read-your-writes claim with its additional assumptions; DDIA explicitly discusses failures of the simple rule.
- **§7.3 relay ordering:** retain the note's label that this is a derivation. These local papers do not prove the single-relay claim or its behavior across reconnections and failover.
- **§9.3 deletion:** the RGA paper adds a structure-specific constraint beyond everyone observing a deletion. Neither its collector nor YATA's historical timeout can be transferred to `@nn` without checking the model.
- **§9 implementation and traffic counts:** these sources explain principles; they do not revalidate the repository snapshot, fan-out probe or proposed origin-filtering changes.

## Lower-priority sources screened

- [Enterprise Integration Patterns][eip], PDF pp. 113–115 (Publish-Subscribe Channel), 255–258 (Resequencer), 469–471 (Idempotent Receiver): useful vocabulary for fan-out, ordering and deduplication in §§4.2, 7 and 9. Its idempotent-assignment example explicitly excludes intervening concurrent changes, so it is not CRDT convergence evidence.
- [System Design Interview, second edition][interview], ch. 6, PDF pp. 95–103: overlaps on quorums, gossip, hinted handoff and Merkle trees. Its `W + R > N` strong-consistency claim on PDF pp. 95–96 is too broad; prefer DDIA's qualifications and the primary papers.

[crdt]: <../../papers/Conflict-free Replicated Data Types.pdf>
[local-first]: <../../papers/Local-First Software - You Own Your Data, in Spite of the Cloud.pdf>
[yata]: <../../papers/Near Real-Time Peer-to-Peer Shared Editing on Extensible Data Types.pdf>
[radt]: <../../papers/Replicated Abstract Data Types - Building Blocks for Collaborative Applications.pdf>
[ddia]: <../../papers/Designing Data-Intensive Applications.pdf>
[uds]: <../../papers/Understanding Distributed Systems 2nd edition.pdf>
[eip]: <../../papers/Enterprise Integration Patterns - Designing, Building And Deploying Messaging.pdf>
[interview]: <../../papers/System Design Interview - An Insider's Guide, Second Edition.pdf>
