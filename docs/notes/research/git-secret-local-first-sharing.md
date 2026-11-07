# Git-secret and selective sharing in local-first apps

Researched **2026-11-05** using official documentation, source code, and protocol specifications. Source snapshots are linked below. This is an architectural comparison, not a cryptographic audit or an implementation plan.

## Short answer

**Git-secret shares access to an encryption key, without sharing anyone's private key.** For each encrypted file, GPG encrypts the content using a random symmetric session key and protects that same key separately for each recipient. Each recipient can decrypt independently. We can apply this envelope-encryption pattern to local-first documents, but we also need authenticated identities, write authorization, membership history, and a policy for offline revocation. [OpenPGP §2.1][openpgp] [Git-secret implementation][hide-source]

First, distinguish the names:

- **`sobolevn/git-secret`**, singular, encrypts files for selected GPG recipients. This is the relevant tool. [Manual][manual]
- **`awslabs/git-secrets`**, plural, scans commits and messages for prohibited secret patterns. It doesn't provide encrypted sharing. [README][aws]
- **`git-crypt`** transparently encrypts selected files through Git filters and can distribute its symmetric key using GPG. Its README explicitly says access revocation/key rotation isn't supported. [README][git-crypt]

## What git-secret actually does

### One encrypted payload, several protected copies of its key

For Alice and Bob, the conceptual output is:

```text
file.secret
  content encrypted with session key K
  K protected for Alice's public key
  K protected for Bob's public key
```

Alice uses her private key to recover K; Bob uses his. Neither needs the other's private key or participation. This is neither threshold encryption nor a separate full-file copy for every recipient. OpenPGP specifies a session key per message and public-key-encrypted session-key packets for recipients. The precise algorithms and packet versions depend on the GPG installation; citing current OpenPGP doesn't imply git-secret uses every RFC 9580 feature. [OpenPGP §§2.1, 5.1][openpgp]

Git-secret delegates this to GPG. Its `hide` implementation gathers recipients once, then invokes `gpg --encrypt` for every tracked secret file; `_get_recipients` produces repeated `-r` arguments. It doesn't maintain one permanent symmetric key for the whole repository. [Hide source][hide-source] [Recipient helper][helpers]

### Adding, encrypting, and revealing

1. `git secret init` creates `.gitsecret/`. Its key directory contains recipients' **public** keys; users retain private keys in their personal GPG keyrings.
2. `git secret tell <email-or-fingerprint>` imports the selected public key from the caller's GPG keyring into the repository keyring.
3. `git secret add <file>` tracks a plaintext file and adds it to `.gitignore`.
4. `git secret hide` writes encrypted `.secret` files. Commit those and the repository's git-secret configuration, excluding `random_seed`.
5. `git secret reveal` calls GPG decryption using a matching private key from the recipient's own keyring. [Manual][manual] [Tell][tell] [Reveal][reveal]

**`tell` alone doesn't grant access to existing ciphertext.** Someone who can already decrypt must reveal and re-encrypt all relevant files with the updated recipient list, then publish the result. The documented workflow uses `git secret reveal` followed by `git secret hide -d`; `-d` deletes the local plaintext afterward. New recipients get those new versions, not automatic access to old Git history. [Manual][manual]

### Authenticating the public key is a separate step

An email address on a key isn't proof of its owner. Git-secret's manual calls for a secure/trusted channel for exchanging public keys. Its encryption command uses `--trust-model=always`, so we must establish authenticity before accepting the key and review changes to the repository keyring. I would verify full fingerprints through an authenticated channel rather than trust an email lookup alone. [Manual][manual] [Tell][tell] [Hide source][hide-source]

### Removal, re-encryption, and groups

`git secret removeperson` removes a public key from the repository keyring. It doesn't rewrite existing ciphertext. A remaining member must reveal and hide **all** protected files again. Avoid partial modes such as `hide -m` and `hide -F` during membership changes: the manual warns they can leave ciphertext inconsistent with `whoknows`. Current `tell` clears cached hashes when adding keys, but full re-encryption remains the clearest rule. [Hide manual][hide] [Tell source][tell-source] [Removal][remove]

There's a documentation inconsistency: the removal page recommends `hide -r`, but the inspected implementation and hide manual have no `-r` option. Use the documented full `hide` operation, optionally `-d`, after recovering plaintext. [Removal][remove] [Hide source][hide-source]

Removal cannot erase old clones, plaintext, or session keys. Old Git revisions remain decryptable by their original recipients. If a removed member knew an API credential, encrypting it again doesn't invalidate that credential; rotate it at its issuer. This follows from the retained-key model and qualifies the README's broad statement that removed users cannot decrypt anymore. [README][git-secret-readme] [Reveal][reveal]

Likewise, an authorized reader can copy plaintext or share recovered keys. The mechanism controls initial access; it cannot force recipients to keep data private.

Within one configured `.gitsecret` directory, `hide` uses the same recipient set for every tracked file. There is no built-in per-file group selection in this flow. `SECRETS_DIR` can select a different configuration directory, but doesn't turn the default setup into a per-document permission system. Local-first selective sharing needs independently keyed sharing units. [Manual][manual] [Hide source][hide-source]

## Applying the mechanism to local-first data

The following is **suggested architecture**, based on the mechanism above and the local-first examples below.

### Match encryption boundaries to sharing boundaries

I would give each independently shared document or small collection its own security context. Encrypt serialized state, changes, or batches of changes before replication, and distribute the content key through recipient-specific encrypted envelopes. For a small group, one wrap per authorized device is a straightforward model; larger groups can use an established group-key protocol.

For example, Alice and Bob can receive the project-plan key while Alice and Carol receive the salary-document key. Bob downloading the salary ciphertext doesn't give him its key. Adding Dave can involve wrapping an existing key if he should receive that key's entire accessible history; otherwise create a new membership/key **epoch**, a version of the security context. Unlike git-secret's CLI workflow, an envelope-based application can support rewrapping without rewriting payloads, if its protocol explicitly supports it. [OpenPGP][openpgp] [HPKE][hpke]

The unit must also be independently usable. Encrypting a single field inside an operation-based CRDT can leave readers without the predecessors needed to interpret later operations. Automerge retains document histories; Keyhive's causal-encryption design deliberately shares predecessor keys to make history readable. We shouldn't generalize that dependency requirement to every state-based CRDT, but should inspect the chosen representation before splitting it. [Automerge modeling][am-model] [Keyhive design][keyhive-notebook]

**Design implication:** separate differently shared data into independent documents/entities, with explicit references between them. A reference shouldn't automatically convey the target's key. If new members must see current state without deleted history, define a supported sanitized snapshot/new-document boundary; merely hiding a history UI isn't enough.

### Separate people, devices, readers, and writers

I would model a user identity as authority over independently replaceable device keys. Authenticate device enrollment and the user-to-public-key binding, then wrap keys for authorized devices, directly or through groups. Removing a lost phone should remove that device without requiring every collaborator to become a new user. Keyhive documents this person-as-group/device-as-key pattern, while explicitly leaving human identity verification to applications. [Keyhive design][keyhive-notebook]

Encryption answers **who can read**, not **who may author changes**. Git-secret's `hide` invokes encryption without signing. With a shared symmetric key, readers can also construct valid encrypted payloads; an authentication tag doesn't distinguish one member from another. Local-first replicas need signed writes, authenticated device identities, and authorization checks against the relevant membership state before merging. A valid signature proves possession of a signing key, not permission to edit this document. Classic Jazz demonstrates this separation through group read keys and signed, permission-checked transactions. [Hide source][hide-source] [OpenPGP §2.2][openpgp] [Jazz encryption][jazz]

The selected protocol should bind document identity, epoch, author, and causal/update identity to authenticated content. It must also handle replay and prevent moving valid ciphertext between contexts. These are protocol requirements, not an invitation to invent a signature format or nonce scheme. HPKE explicitly leaves replay protection and other embedding responsibilities to applications. [HPKE §§8–9][hpke]

### Offline revocation is a consistency policy

I would require explicit answers to these cases:

- **Removing a reader:** advance to a fresh key epoch available only to remaining members. Deleting their stored key wrap cannot invalidate a key they retained.
- **An offline writer:** until it learns about removal, it can still encrypt new edits with an old key readable by the removed member. Revocation protects data produced under the updated security context, not all writes after a wall-clock instant.
- **A late edit:** decide whether old-epoch edits are accepted, quarantined, or rejected. A malicious removed writer can claim an earlier timestamp or causal context; honest delay and malicious backdating aren't generally distinguishable from those claims alone.
- **Concurrent administrators:** specify how conflicting grants, removals, and rotations reconcile. A document CRDT's convergence doesn't automatically define safe membership convergence.
- **History:** decide whether new members receive historical keys or only a new snapshot. Keeping history keys also changes forward-secrecy expectations. [Keyhive design][keyhive-notebook] [Threat model][keyhive-threats] [MLS §§14–16][mls]

These decisions also affect edits that depend on rejected changes. A system that permits offline work needs deterministic reconciliation or an explicit authority/checkpoint boundary, rather than silently treating the latest local membership list as globally current.

### Sync, metadata, and recovery

Use selective sync alongside encryption: route documents only to relevant peers, authenticate fetch/write requests, and let untrusted relays store ciphertext. Encryption alone doesn't hide document existence, membership, sizes, timing, or graph structure. Keyhive explicitly lists those metadata exposures; HPKE doesn't promise traffic-analysis protection either. [Threat model][keyhive-threats] [HPKE §§9.7, 9.9][hpke]

Key recovery needs a product decision before rollout: an enrolled spare device, protected recovery secret, or explicitly trusted recovery recipient. Losing every usable private key and key backup loses access; making the server a recovery recipient changes the trust model. I would document that choice separately from login recovery. Keyhive itself leaves key recovery and storage to the host application. [Threat model][keyhive-threats]

## Existing systems and specifications

**Automerge Repo:** provides document storage and synchronization, not a complete built-in end-to-end identity/encryption/authorization system. The inspected source does offer experimental `shareConfig.access` and `.announce` hooks. Its default allows access and announcements; legacy `sharePolicy` maps to announcements while access stays allowed. Calling that legacy hook an access-control boundary would be wrong. The tutorial also warns that its public sync server isn't production-secure. [Repo source][am-repo] [Tutorial][am-tutorial]

**Classic Jazz:** is a concrete implementation of the shared-read-key model. CoValues belong to groups, transactions are signed and checked against permissions, and removing a member rotates the read key for future transactions. Its source stores sealed key revelations per member. This comparison is specifically about **classic Jazz**: the maintainers recommend migrating to v2 and describe v2 as trusting the server for access control, with encrypted columns planned for sensitive fields. Their migration post promises continued classic security fixes. Neither description establishes an independent security audit. [Encryption][jazz] [Group source][jazz-source] [Migration post][jazz-v2]

**Keyhive:** directly targets offline authorization, concurrent group key agreement, and encrypted causal content; Subduction is its separate sync project. However, its current README says **pre-alpha, unaudited, do not use in production**. The threat model documents unresolved revocation/key-binding gaps and says content authorship checks belong to the CRDT layer. It's a strong research reference, not a production-ready drop-in wrapper. See the companion [Keyhive note](keyhive.md). [README][keyhive] [Threat model][keyhive-threats]

**HPKE, RFC 9180:** is a CFRG Informational RFC specifying hybrid public-key encryption for a recipient. A reviewed implementation can protect recipient-specific key envelopes; HPKE alone doesn't supply membership, recovery, durable write authorization, or replay handling. Its base mode doesn't authenticate the sender. [RFC 9180 §§5, 9][hpke]

**MLS, RFC 9420:** is an IETF Standards Track protocol for asynchronous group key establishment with forward secrecy and post-compromise security. Its epochs form a linear sequence, and applications must resolve competing commits. It therefore isn't automatically a coordination-free membership CRDT. Long-lived document history and backups also require choices beyond messaging key deletion. Specification status isn't an audit of a chosen implementation. [RFC 9420 §§3, 9, 14–16][mls]

## Implications for NN

Current [`SyncEngine`](../../../packages/sync-engine/src/sync-engine.ts) pushes `Encoded` entities and decodes pulled/received values before `State.merge`. [`LWWMap.encode`](../../../packages/entities/src/lww-map.ts) recursively includes nested fields, while [`State.merge`](../../../packages/store/src/state.ts) matches top-level entities and keys. [`LWWRegister.merge`](../../../packages/entities/src/lww-register.ts) resolves timestamp order, not author permissions.

**Proposed integration boundary:** encrypt serialized entities before remote transport; verify authorization and decrypt before decoding and merging. Encrypting a whole map under one key grants access to its encoded descendants. Selective sharing would therefore need independently encrypted units or finer-grained synchronization. This is an architectural implication, not an implemented security property.

The example server's [`update`](../../../apps/example-server/src/services/db/db.ts) uses `Object.assign(db, data)`, replacing same-named fields. Wrapping that transport alone wouldn't preserve concurrent encrypted snapshots: authorized clients must decrypt and merge, while replication must retain concurrent updates until reconciliation. Blindly replacing one ciphertext with another isn't a CRDT merge.

## Recommendation and remaining questions

Reuse **envelope encryption per sharing unit**, with authenticated device enrollment and signed, authorized writes. Choose the membership/history semantics and an established protocol implementation before designing wire formats. Git-secret explains key distribution well; it doesn't solve offline authorization.

Still open: required history access, acceptable offline revocation delay, authority for membership conflicts, recovery trust, and whether NN should sync independently shared entities or change batches. This research didn't run the tools or establish deployment maturity beyond the cited maintainers' statements.

[openpgp]: https://www.rfc-editor.org/rfc/rfc9580.html#section-2.1
[aws]: https://github.com/awslabs/git-secrets#description
[git-crypt]: https://github.com/AGWA/git-crypt/blob/master/README.md
[manual]: https://github.com/sobolevn/git-secret/blob/e6d288551a5cff3845a9293c48e94353e561a3f1/man/man7/git-secret.7.md
[git-secret-readme]: https://github.com/sobolevn/git-secret/blob/e6d288551a5cff3845a9293c48e94353e561a3f1/README.md
[tell]: https://github.com/sobolevn/git-secret/blob/e6d288551a5cff3845a9293c48e94353e561a3f1/man/man1/git-secret-tell.1.md
[hide]: https://github.com/sobolevn/git-secret/blob/e6d288551a5cff3845a9293c48e94353e561a3f1/man/man1/git-secret-hide.1.md
[reveal]: https://github.com/sobolevn/git-secret/blob/e6d288551a5cff3845a9293c48e94353e561a3f1/man/man1/git-secret-reveal.1.md
[remove]: https://github.com/sobolevn/git-secret/blob/e6d288551a5cff3845a9293c48e94353e561a3f1/man/man1/git-secret-removeperson.1.md
[hide-source]: https://github.com/sobolevn/git-secret/blob/e6d288551a5cff3845a9293c48e94353e561a3f1/src/commands/git_secret_hide.sh
[tell-source]: https://github.com/sobolevn/git-secret/blob/e6d288551a5cff3845a9293c48e94353e561a3f1/src/commands/git_secret_tell.sh
[helpers]: https://github.com/sobolevn/git-secret/blob/e6d288551a5cff3845a9293c48e94353e561a3f1/src/_utils/_git_secret_tools.sh
[hpke]: https://www.rfc-editor.org/rfc/rfc9180.html
[mls]: https://www.rfc-editor.org/rfc/rfc9420.html
[am-model]: https://automerge.org/docs/cookbook/modeling-data/
[am-repo]: https://github.com/automerge/automerge-repo/blob/6e2101acbf1151cf35d6bd17b7dc61a6384fc828/packages/automerge-repo/src/Repo.ts
[am-tutorial]: https://automerge.org/docs/tutorial/next-steps/
[jazz]: https://classic.jazz.tools/docs/vanilla/reference/encryption
[jazz-source]: https://github.com/garden-co/classic-jazz/blob/e51832fd1f495a771d89f9c26aa9f6a62c3e0690/packages/cojson/src/coValues/group.ts
[jazz-v2]: https://jazz.tools/blog/what-we-learned-from-classic-jazz
[keyhive-notebook]: https://www.inkandswitch.com/keyhive/notebook/01/
[keyhive]: https://github.com/inkandswitch/keyhive/blob/b5fd307e2fc77605532832ce276b30287e43b1c4/README.md
[keyhive-threats]: https://github.com/inkandswitch/keyhive/blob/b5fd307e2fc77605532832ce276b30287e43b1c4/design/threat_model.md
