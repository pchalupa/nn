# Keyhive: local-first authorization, encryption, and sync

Researched **2026-11-05**, starting from the [Ink & Switch notebook][notebook]. This note uses primary sources: the notebook, official repositories, package registries, and the authors' BeeKEM preprint page. Implementation references are pinned to Keyhive [`a177013`][keyhive-snapshot] and Subduction [`c5bde74`][subduction-snapshot]. “Current” means those source snapshots, not necessarily the published packages. I inspected documentation and selected implementation paths; I did not run the projects or independently verify cryptographic proofs.

## Summary

Keyhive aims to give local-first applications sharing, delegated permissions, revocation, and end-to-end encryption without an always-online authorization server. Authorization travels with replicated data, so devices can work offline and reconcile later. Automerge motivated the project, but the implementation is intended for other local-first data too. [Notebook 00–01][background] [Naming][naming]

There is substantial implemented machinery, not just a notebook proposal: Rust libraries, Wasm/TypeScript bindings, a replicated authority graph called **Keyline**, group key agreement called **BeeKEM**, and causal content encryption. **Subduction**, the successor to **Beelay**, handles synchronization in a separate repository. Both projects still explicitly reject production use. Keyhive's current threat model lists concrete security gaps, including revoked members reintroducing keys. [Workspace][workspace] [Threat model][threats] [Subduction][subduction]

For NN, the useful direction is a security layer around replicated content. It would not replace NN's merge semantics, and it is not a drop-in encryption wrapper. The missing boundary is trustworthy authorship and authorization before merge, with a defined policy for content affected by revocation. See the final section.

## Purpose and evolution

The notebook asks what “Signal for documents” would require: familiar sharing without trusting a server with plaintext or requiring a connection to approve every edit. Offline authorization must address conflicting membership changes, late-arriving edits, malicious backdating, and nested groups. The original goals included tens of thousands of documents and large reader/writer populations; these are design targets, not verified deployment limits. Binding public keys to real people was explicitly excluded. [Notebook 00][origin] [Notebook 01][background]

The chronology matters:

- **2024:** the notebook described three layers: convergent capabilities, a group-management CRDT, and causal encryption.
- **January–March 2025:** it introduced BeeKEM, renamed Beehive to Keyhive, opened pre-alpha code, and described Beelay synchronization. The March release was explicitly unaudited. [BeeKEM notebook][bee-notebook] [Naming][naming] [Opening][opening] [Sync notebook][sync-notebook]
- **July 2026:** the BeeKEM preprint appeared, followed by a notebook entry explaining concurrency/security trade-offs, including retained historical secrets. [Paper][paper] [Notebook 06][security-notebook]
- **November 2026 source:** Keyline is the authority substrate; Beelay is now Subduction; content and cryptographic support have separate crates. The current sources supersede older API names and some early security descriptions. [Workspace][workspace] [Keyline][keyline]

## Architecture and exact component relationships

| Component                         | Current responsibility                                                                              |
| --------------------------------- | --------------------------------------------------------------------------------------------------- |
| `keyline`                         | Signed delegation/revocation types and the `Keyline` store interface; defines authority evaluation. |
| `keyline_memory`                  | In-memory reference implementation of that interface.                                               |
| `beekem`                          | Concurrent group key agreement over a tree, independent of application identity semantics.          |
| `keyhive_content`                 | Encrypted content format, application secrets, causal envelopes, and ciphertext storage.            |
| `keyhive_crypto`, `keyhive_codec` | Shared cryptographic primitives and canonical binary encoding.                                      |
| `keyhive_core`                    | Connects authority, typed individuals/groups/documents, key agreement, and content encryption.      |
| `keyhive_wasm`                    | Browser/Node bindings, published as `@keyhive/keyhive`.                                             |
| Subduction / `sedimentree_core`   | Separate synchronization stack and its history-partitioning structure.                              |

Keyline and BeeKEM are separate engines over keys. `keyhive_core` supplies the relationships: authority determines document membership, membership determines who should receive encryption keys, and causal encryption uses those keys for content. Sedimentree organizes history fragments and metadata so peers can synchronize opaque encrypted content. [Workspace][workspace] [Keyline implementation][keyline-implementation] [Subduction][subduction]

One documentation discrepancy is worth preserving: Subduction's README still lists a separate `subduction_keyhive_policy` crate. Its current workspace does not contain that crate. The implemented policy is `subduction_keyhive::policy::SubductionKeyhive`, implementing `ConnectionPolicy` and `StoragePolicy`; the same crate contains Keyhive protocol/storage integration. [Subduction manifest][subduction-manifest] [Policy source][policy] [Integration source][integration]

## Authorization, delegation, and offline convergence

**Current Keyline model:** every node is an Ed25519 verifying key. The authority engine does not distinguish documents, groups, and individuals; higher layers do. A signed delegation identifies an issuer, audience, subject, and power. The power ladder is `Relay < Read < Edit < Admin`: forwarding ciphertext, decrypting content, editing content, and administering authority. [Keyline][keyline]

Effective authority is attenuated: it cannot exceed the weakest grant along a route, while independent routes can provide stronger access. Groups compose through membership and grants to those groups. Delegations contain no embedded proof chain; evaluation derives authority from the certificate set. An ungrounded cycle grants nothing. Importantly, delegation does not inherently require Admin: existing authority can be passed on, capped at the issuer's power. The core `add_member` API rejects attempted escalation. [Keyline implementation][keyline-implementation] [Core source][core]

The certificate collection is a **grow-only, state-based CRDT**: merge is set union, and equal certificate sets yield equal authority regardless of arrival order. A revocation adds a signed fact naming a delegation; it does not delete history. This differs from BeeKEM operations, which have causal predecessors and may need buffering or replay. “Offline” therefore means decisions using the state a replica has, with convergence after exchange, not immediate awareness of every remote revocation. [Keyline][keyline] [BeeKEM implementation overview][beekem] [Threat model][threats]

Delegation is late-bound. If an issuer loses standing, downstream delegations become ineffective; restoring the same key's standing can revive them. Explicitly revoked certificates remain revoked. Re-granting uses a fresh certificate, with `citation` changing its identity rather than undoing the revocation. This is useful for recovery but makes accidental re-addition significant. [Keyline][keyline]

## Revocation is more than removing a member

Keyline evaluates revocation coverage against the **positive graph**, ignoring all revocations, then computes live authority separately. That prevents revocations from disabling one another according to delivery order. Concurrent peer-admin revocations both stand. The certificate issuer/audience can revoke their own relationship; third-party revocations are scoped through the revoker's historical admin reach. [Keyline][keyline]

The trade-off is explicit: **an ex-admin retains deny-only revocation power over that reach**. Durable removal can require rotating a role to a new key and rebuilding its membership. Rotation has limits when the removed admin had authority over the subject itself. Root-role peer conflicts can permanently strand authority if no recovery path remains. These are current documented model semantics, not promises that arbitrary administrator conflicts resolve harmlessly. [Keyline, revocation and root-role sections][keyline]

For content, revocations can include `retain` watermarks: document heads recording which earlier content should survive. `keyhive_core::set_content_heads` relies on the application to supply those heads. The content layer must enforce retention and decide what to do with concurrent edits, missing watermarks, and multiple retention bounds. The current threat model explicitly says **no content layer here reads `retain` yet**. Descriptions of “whiteout” or excluding revoked edits must therefore not be read as a complete implemented pipeline. [Core source][core] [Keyline implementation][keyline-implementation] [Threat model T5/open questions][threats]

No protocol can make a former reader forget plaintext or keys already obtained. Keyhive also cannot distinguish an honestly delayed edit from a maliciously backdated one solely from claimed causal predecessors; trusted anchoring would be an additional application choice. [Threat model][threats]

## Encryption, key distribution, and concurrency

BeeKEM is a decentralized continuous group key agreement protocol: membership and key updates can happen concurrently without a central ordering service. Members occupy leaves of a binary tree. Updating a leaf refreshes secrets along its path; members derive the root secret using their own secrets and encrypted intermediate secrets. Blank or conflicting nodes require encrypting for multiple descendants. Common-case operations are logarithmic in group size, but worst-case operations are linear and conflict storage can reach `O(n log n)`. These bounds do not establish whole-application throughput. [BeeKEM][beekem] [Paper abstract][paper]

Concurrent updates retain conflicting keys rather than arbitrarily discarding one. Removes blank affected paths after concurrent operations are reconciled. Membership changes or conflicting roots require a subsequent fresh update before a usable new root exists. The current implementation description samples ancestor secrets independently, unlike the January 2025 notebook's path-secret derivation explanation. [BeeKEM][beekem] [Original explanation][bee-notebook]

Keyhive derives per-content application keys from a BeeKEM root secret, predecessor references, and the content reference. Encrypted bodies carry predecessor references and their keys, so decrypting an entry point reveals its causal history recursively. This deliberately enables history access for later collaborators. Current primitives are Ed25519 signatures, X25519 key exchange, BLAKE3 hashing/key derivation, and XChaCha20-Poly1305 encryption. The synthetic-nonce/key-commitment construction combines these primitives but is **not a standard reviewed AEAD mode**. [Causal encryption][causal] [Cipher suite][ciphersuite]

**Do not repeat the early blanket forward-secrecy claim.** The January notebook said standalone BeeKEM provides forward secrecy, while already excluding Keyhive as a whole. July's clarification says the actual implementation retains unbounded historical individual secrets, expressed as security parameter κ = ∞. The current BeeKEM README explicitly says no forward secrecy. Post-compromise security concerns refreshing secrets after compromise; it does not recover historical confidentiality or protect a host that remains compromised. [Original footnote][bee-notebook] [July clarification][security-notebook] [Current README][beekem]

Read access is intended to seat only readers and stronger members in BeeKEM. Relay-only peers carry encrypted data and key-agreement operations without receiving plaintext keys. Contact cards provide signed prekey introductions for asynchronous sharing; they do not verify the human behind the key. [Threat model][threats] [Contact-card source][contact] [Wasm usage][wasm]

## Identity and devices

The documented pattern represents a person as a group and their devices as individual keys. A device identity is an immutable Ed25519 public key; replacing it means adding a new individual and removing the old one. Nested groups can represent teams, organizations, or document collections. This is a modeling pattern, not a built-in account directory or recovery service. [Sync notebook][sync-notebook]

Applications own real-person verification, discovery, backup, recovery, and secret storage. Rust's `AsyncSigner` allows host-controlled signing. The Wasm `Signer.generate()` prefers a non-extractable WebCrypto key and falls back to an in-memory signer. A non-extractable signing key does not imply that all encryption secrets or decrypted data are protected from a compromised application host. [Wasm][wasm] [Threat model][threats]

## Sync and integration APIs

The 2025 Beelay notebook proposed membership reconciliation, collection reconciliation, then per-document key-agreement and Sedimentree synchronization. It used rateless invertible Bloom lookup tables to find set differences and exposed enough history metadata to sync ciphertext. Treat that sequence and its two-round-trip optimization as notebook-era protocol descriptions, not a verified current Subduction wire contract. [Sync notebook][sync-notebook]

Current Subduction supports Rust/Wasm, transport adapters, and Automerge bindings. Its Keyhive policy checks peer access and distinguishes fetching from authored writes. Subduction is encryption-friendly, but opaque-blob synchronization alone does not authenticate the content author's edit authority. Keyhive's own threat model says encrypted content chunks have no author signature and that distinguishing Read from Edit on the content path belongs to the CRDT/application layer. [Subduction][subduction] [Policy][policy] [Threat model T2][threats]

The current Wasm API starts with `Signer.generate()`, `CiphertextStore.newInMemory()`, and `Keyhive.init(...)`. It exposes `generateGroup`, `generateDocument`, `addMember`, `revokeMember`, `tryEncrypt`, `tryDecrypt`, `reachableDocs`, `forcePcsUpdate`, and sync-event ingestion. Encryption takes a document, content/change reference, causal predecessors, and bytes. Predecessor keys must already be known from encrypting or decrypting that content. This is an integration contract for a causal content history, not simply `encrypt(JSON)`. [Wasm README][wasm] [Rust encryption implementation][core]

A version mismatch also matters: Subduction's inspected manifest depends on `keyhive_core = "0.7.0"`, while Keyhive's registry latest is `0.10.0`. Its policy imports the older `Access` API rather than current Keyline `Power`. Do not combine snippets from both main branches and assume compatibility. [Subduction manifest][subduction-manifest] [Policy source][policy] [Core registry][core-registry]

## Maturity, limitations, and unresolved questions

Activity is current: Keyhive's inspected main commit is dated **November 5, 2026**; Subduction's is **November 4**. The latest npm `@keyhive/keyhive` is **0.6.0**, published October 29; its GitHub release is marked prerelease. Registry latest versions are `keyhive_core` **0.10.0** and `beekem` **0.7.0**, both published October 28. Publication and version numbering do not override the repositories' pre-alpha/early-preview warnings. [Snapshots][keyhive-snapshot] [Subduction snapshot][subduction-snapshot] [npm][npm] [Release][release] [Core registry][core-registry] [BeeKEM registry][bee-registry]

The July BeeKEM paper reports a protocol with security proofs and performance competitive with OpenMLS. Its publication metadata says **preprint**. That is evidence of formal protocol work, not an implementation audit or a proof covering Keyhive, its bindings, storage, and Subduction end to end. I reviewed its abstract/metadata, not the proof in full. [Paper][paper]

The current Keyhive threat model lists four implemented-system gaps:

1. A revoked member can delegate to a fresh key and get it seated because CGKA authorization consults positive standing.
2. A CGKA add does not bind its supplied share key to the added member's published prekeys.
3. Even a relay can misuse a self-issued/self-revoked delegation to evict a legitimate reader from the key tree.
4. Membership-to-tree reconciliation runs after local membership writes; received certificates do not trigger equivalent reconciliation everywhere.

These are upstream's documented findings, not independently reproduced exploits. They materially qualify any claim that current membership revocation securely excludes former readers. [Threat model G1–G4][threats]

Other open concerns are independent review of the synthetic-nonce construction; content-authorship and retention enforcement; compatibility across versions; and application recovery after root/admin failure. Metadata privacy is limited: relays can see document existence, membership, graph shape, sizes, and timing. Availability, host compromise, identity, and key recovery remain outside Keyhive's guarantees. Production-scale benchmarks for the complete current stack were not established by this review. [Threat model][threats] [Keyline][keyline]

## Practical relevance to NN

NN currently merges decoded remote entities directly in [`SyncEngine`](../../../packages/sync-engine/src/sync-engine.ts), including initial pulls and subsequent receives. [`LWWMap`](../../../packages/entities/src/lww-map.ts) performs nested entity merging and encoding; [`Remote`](../../../packages/remote/src/remote.ts) exposes only pull, push, and connection operations. Those interfaces do not themselves establish a cryptographic authorization boundary.

**Inference:** Keyhive could inform a layer that authenticates content, resolves access, and decrypts before NN merges it. That still requires deciding the authorization unit, mapping entities to documents, representing causal content and authorship, persisting key/authority state, and handling previously merged writes after revocation. Encryption inside an HTTP adapter alone would not supply these semantics. Keyhive's explicit delegation and causal-history model is useful research input; the documented security gaps make the current stack unsuitable as an assumed production security foundation. [Required content contract][core] [Security responsibilities][threats]

## Source index

Notebook links preserve historical claims. Repository links below pin the inspected revisions so future changes do not silently alter this note's evidence.

- **Historical design:** [notebook index][notebook], [early architecture][background], [BeeKEM][bee-notebook], [Beelay sync][sync-notebook], and [2026 security clarification][security-notebook].
- **Current authority and integration:** [workspace][workspace], [Keyline model][keyline], [Keyline implementation][keyline-implementation], [core source][core], and [Wasm API][wasm].
- **Cryptography and limitations:** [BeeKEM implementation overview][beekem], [causal encryption][causal], [cipher suite][ciphersuite], [threat model][threats], and [BeeKEM preprint][paper].
- **Current sync:** [Subduction overview][subduction], [manifest][subduction-manifest], and [implemented authorization policy][policy].
- **Release evidence:** [npm registry][npm], [GitHub prerelease][release], [core crate registry][core-registry], and [BeeKEM crate registry][bee-registry].

[notebook]: https://www.inkandswitch.com/keyhive/notebook/
[origin]: https://www.inkandswitch.com/keyhive/notebook/00/
[background]: https://www.inkandswitch.com/keyhive/notebook/01/
[naming]: https://www.inkandswitch.com/keyhive/notebook/03/
[bee-notebook]: https://www.inkandswitch.com/keyhive/notebook/02/
[opening]: https://www.inkandswitch.com/keyhive/notebook/04/
[sync-notebook]: https://www.inkandswitch.com/keyhive/notebook/05/
[security-notebook]: https://www.inkandswitch.com/keyhive/notebook/06/
[paper]: https://eprint.iacr.org/2026/1434
[keyhive-snapshot]: https://github.com/inkandswitch/keyhive/commit/a177013d275368f4bd80b4770de1a9c0884dcb21
[subduction-snapshot]: https://github.com/inkandswitch/subduction/commit/c5bde7496cc052be114c226ded99e817d43c3fd4
[workspace]: https://github.com/inkandswitch/keyhive/blob/a177013d275368f4bd80b4770de1a9c0884dcb21/README.md
[threats]: https://github.com/inkandswitch/keyhive/blob/a177013d275368f4bd80b4770de1a9c0884dcb21/design/threat_model.md
[keyline]: https://github.com/inkandswitch/keyhive/blob/a177013d275368f4bd80b4770de1a9c0884dcb21/design/keyline/README.md
[keyline-implementation]: https://github.com/inkandswitch/keyhive/blob/a177013d275368f4bd80b4770de1a9c0884dcb21/design/keyline/implementation.md
[beekem]: https://github.com/inkandswitch/keyhive/blob/a177013d275368f4bd80b4770de1a9c0884dcb21/beekem/README.md
[causal]: https://github.com/inkandswitch/keyhive/blob/a177013d275368f4bd80b4770de1a9c0884dcb21/design/causal_encryption.md
[ciphersuite]: https://github.com/inkandswitch/keyhive/blob/a177013d275368f4bd80b4770de1a9c0884dcb21/design/ciphersuite.md
[core]: https://github.com/inkandswitch/keyhive/blob/a177013d275368f4bd80b4770de1a9c0884dcb21/keyhive_core/src/keyhive.rs
[contact]: https://github.com/inkandswitch/keyhive/blob/a177013d275368f4bd80b4770de1a9c0884dcb21/keyhive_core/src/contact_card.rs
[wasm]: https://github.com/inkandswitch/keyhive/blob/a177013d275368f4bd80b4770de1a9c0884dcb21/keyhive_wasm/README.md
[subduction]: https://github.com/inkandswitch/subduction/blob/c5bde7496cc052be114c226ded99e817d43c3fd4/README.md
[subduction-manifest]: https://github.com/inkandswitch/subduction/blob/c5bde7496cc052be114c226ded99e817d43c3fd4/Cargo.toml
[policy]: https://github.com/inkandswitch/subduction/blob/c5bde7496cc052be114c226ded99e817d43c3fd4/subduction_keyhive/src/policy.rs
[integration]: https://github.com/inkandswitch/subduction/blob/c5bde7496cc052be114c226ded99e817d43c3fd4/subduction_keyhive/src/lib.rs
[npm]: https://registry.npmjs.org/@keyhive%2Fkeyhive
[release]: https://github.com/inkandswitch/keyhive/releases/tag/keyhive-wasm/0.6.0
[core-registry]: https://crates.io/api/v1/crates/keyhive_core
[bee-registry]: https://crates.io/api/v1/crates/beekem
