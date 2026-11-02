# Swift delegates and observation

Research date: **2026-10-31** (Apple documentation, Swift Evolution proposals, Swift book and `swiftlang/swift` source at pinned commits).
Scope: how Swift and Apple frameworks propagate changes (delegates, Observation, Combine, KVO, NotificationCenter, `AsyncStream`), and what that means for the proposed delegate-based change propagation in `@nn/entities`, `@nn/store` and `@nn/remote`.

## Short answer

Apple uses a **delegate** when exactly one object coordinates with, or acts for, another object, usually its owner. The delegating object has one weak `delegate` slot. Its methods name the sender's class, pass the sender first, and use `will`/`did` for notifications and `should` for vetoes. [Cocoa naming][cocoa-naming] [Delegation][cocoa-delegation] [Swift book][tspl-protocols] When **several** objects need the same event, Apple does not provide a multicast delegate. It posts a notification or exposes a publisher or observation. `UIApplication` does both: it calls its delegate first, then posts a broadcast notification. [applicationDidBecomeActive][uiapp-active]

Swift's newer observation APIs are built around **transactions**, not single property events. `withObservationTracking` fires once, on `willSet`, for properties read inside its closure. `Observations` (SE-0475) opens a transaction at the first `willSet` and delivers one consistent value at the next suspension point. SE-0506 added `didSet` and continuous tracking because synchronous model-to-model synchronization needs "immediate and non-coalesced events … after a value has been set". [SE-0395][se0395] [SE-0475][se0475] [SE-0506][se0506]

For nn, the proposal matches Apple's split. Use a single-owner delegate for Entity→parent, State→Store and Remote→Store, and a listener set only for React. Three details differ from a direct port:

- **Use did-change timing everywhere.** A `useSyncExternalStore` listener must find the new snapshot already readable, which is the `didSet` contract, not Combine's `objectWillChange`.
- **Weak references do not translate.** JavaScript collects cycles. What carries over is explicit detachment, because JavaScript has no deterministic `deinit` that could replace `AnyCancellable` or `NSKeyValueObservation` tokens.
- **Pass enough context to identify the changed child.** Sender-first alone does not tell State which top-level field changed once fields notify the root `LWWMap` rather than State.

## 1. Delegate pattern

### What a delegate is, and why it is weak

The Swift book defines delegation as handing off responsibilities to "an instance of another type", through a protocol that the delegate adopts. Its `DiceGame` example declares `weak var delegate: Delegate?` and restricts the protocol with `AnyObject`. "To prevent strong reference cycles, delegates are declared as weak references", and only class-only protocols can be held weakly. [Swift book, Delegation][tspl-protocols] The cycle is concrete in UIKit. A view controller usually owns its table view, and the table view's `delegate` and `dataSource` are both declared `weak`: "The delegate isn't retained." [UITableView.delegate][uitv-delegate] [UITableView.dataSource][uitv-datasource] The retired Cocoa glossary states the same rule. In a managed-memory environment, "the delegating object maintains a weak reference to its delegate", but a garbage-collected environment kept a strong one. [Delegation][cocoa-delegation]

The pattern is therefore **child → owner**, with a non-owning back-reference, which is also the direction of nn's Entity→parent and State→Store links.

### Delegate and data source

Cocoa splits one role into two protocols. "A data source is almost identical to a delegate"; the difference is that the delegate controls UI behaviour, while the data source controls data. [Delegation][cocoa-delegation] Both are single slots, and both can return values to the delegating object. Listeners cannot return values in the same way: a broadcast has no single answer.

### Naming: sender first, will/did/should

The Cocoa _Coding Guidelines_ give the delegate-method shape [Cocoa naming][cocoa-naming]:

- Start with the sending class without its prefix, then a colon and the sender. Examples are `tableView:shouldSelectRow:` and `application:openFile:`. A method whose only argument is the sender has no colon, for example `applicationOpenUntitledFile:`.
- Use "did" or "will" when something has happened or is about to happen, for example `browserDidScroll:`. Use "should" when the method asks the delegate to decide something, for example `windowShouldClose:`.
- Methods invoked because a notification was posted are an exception. Their only argument is the notification object, for example `windowDidChangeScreen:`.

In Swift this becomes `tableView(_ tableView: UITableView, didSelectRowAt indexPath: IndexPath)`. [didSelectRowAt][uitv-didselect] The `will` variant can redirect the action. `tableView(_:willSelectRowAt:)` returns a different `IndexPath` or `nil` to cancel selection. [willSelectRowAt][uitv-willselect] Passing the sender lets one delegate object serve several senders, such as two table views, without one closure per sender. The Swift book uses the same shape: `gameDidStart(_ game:)` and `game(_:didEndRound:winner:)`. [Swift book][tspl-protocols] The Swift API Design Guidelines do not mention delegates. Their general argument-label rules apply. [API guidelines][api-guidelines]

### Optional methods

Optional protocol requirements exist only for Objective-C interoperability. Both the protocol and the requirement must be `@objc`, which limits adoption to classes. The method type becomes optional, so callers use optional chaining. [Swift book, Optional Protocol Requirements][tspl-protocols] UIKit delegate methods are `optional func`. [didSelectRowAt][uitv-didselect] Pure Swift code typically provides defaults in protocol extensions. In TypeScript, optional interface methods (`entityWillChange?(…)`) play the same role.

### One delegate, many observers

A delegate slot holds one object. Apple's documented answer to "several parties need this event" is a **notification alongside the delegate**, not a multicast delegate. `applicationDidBecomeActive(_:)` documentation says: "After calling this method, UIKit posts a `didBecomeActiveNotification` to give interested objects a chance to respond." [applicationDidBecomeActive][uiapp-active] The Cocoa glossary shows the same split: a window "posts an `NSWindowWillCloseNotification` to observers but sends a `windowShouldClose:` message to its delegate". It also says most framework classes automatically register their delegate as an observer of their own notifications. [Delegation][cocoa-delegation] The rule is **owner gets the delegate call first, and everyone else gets a broadcast afterwards**. Veto decisions (`should`) belong only to the delegate.

## 2. Observation framework (Swift 5.9+, iOS 17)

### `@Observable` and `ObservationRegistrar`

`@Observable` generates an `_$observationRegistrar` and `access`/`withMutation` members and conforms the type to `Observable`. [Observable()][observable-macro] The registrar's `withMutation(of:keyPath:_:)` calls `willSet`, runs the mutation, and calls `didSet` in a `defer`. It stores observers in a dictionary keyed by integer id, with a reverse index `[AnyKeyPath: Set<Int>]`, so a mutation reaches only observers of that key path. When the registrar is released, it runs `deinit` trackers. [ObservationRegistrar.swift][registrar-src]

### `withObservationTracking(_:onChange:)`

Properties read inside `apply` are tracked, and others are ignored. [withObservationTracking][wot-doc] SE-0395 says `onChange` is called "on the first change". [SE-0395][se0395] The Apple documentation does not state its timing. The source does. The public overload installs a `willSet` observer that calls `onChange()` and then `tracking.cancel()`. Delivery is therefore **one-shot and before the new value is stored**. To keep observing, the caller must track again. [ObservationTracking.swift][tracking-src]

SE-0506 (Swift 6.4) adds `withObservationTracking(options:)` with `.willSet`, `.didSet` and `.deinit`, plus `withContinuousObservationTracking`. That variant re-arms automatically and is kept alive by a token. Its motivation directly addresses synchronous propagation: the old API "can only inform observers of events that will occur and may coalesce events", whereas syncing "two data models … after a value has been set" needs immediate `didSet` events. [SE-0506][se0506]

### `Observations` (SE-0475, Swift 6.2)

`Observations { … }` is an `AsyncSequence` of values computed by a closure that runs inside `withObservationTracking`. A transaction starts at "the first trigger of a leading edge (the `willSet`)" and completes at "the next suspension of that isolation". Therefore `firstName` and `lastName` set back to back are emitted together, never torn. The first value is produced on the first `next()`. No extra buffer exists. When production outpaces iteration, "some values may not be represented", but each delivered value is consistent. `Observations.untilFinished` ends by returning `.finished`. [SE-0475][se0475] [Observations][observations-doc] SE-0395 explains the design: direct will/did events "did not offer the correct granularity for supporting the required synchronization between dependent members", so transactions were "worth the extra complexity". [SE-0395 alternatives][se0395]

### SwiftUI's fine-grained invalidation

"When body is executed, SwiftUI tracks all access to properties used from 'Observable' types." A view is invalidated only when a property it read changes, and tracking is per instance. Arrays and optionals of models therefore work. [WWDC23 Discover Observation][wwdc23] With `ObservableObject`, a view updates when _any_ published property changes, even one `body` didn't read. [Migrating to Observable][migrate] [Managing model data][model-data] This is the auto-tracking approach already covered for MobX, Vue and Legend State in [auto-tracking.md](auto-tracking.md).

## 3. Combine

`ObservableObject` is "a type of object with a publisher that emits before the object has changed". `objectWillChange` fires before any `@Published` property changes. [ObservableObject][observableobject] `@Published` publishes in `willSet`, so a sink that reads the property gets the old value. [Published][published] SE-0395 calls this behaviour "restrictive for non-SwiftUI usage and … surprising", while noting that it "serves SwiftUI well". It also criticizes `@Published` for giving no "distinction as to the source of changes". [SE-0395][se0395] Apple does not document _why_ SwiftUI wants will-change. The likely reason is that SwiftUI only needs a "dirty" signal to schedule a later render and reads values during that render. This is an inference, not an Apple statement.

`PassthroughSubject` has no current value and drops values with no subscribers or zero demand. `CurrentValueSubject` buffers the latest element, and `send` updates `value`. [PassthroughSubject][pts] [CurrentValueSubject][cvs] Subscriptions end through **lifetime**. "An `AnyCancellable` instance automatically calls `cancel()` when deinitialized." `store(in:)` puts it in a set owned by the subscriber. [AnyCancellable][anycancellable]

## 4. KVO and NotificationCenter

**KVO** works only on `NSObject` subclasses with `@objc dynamic` properties. [Using KVO in Swift][kvo-guide] `observe(_:options:changeHandler:)` returns an `NSKeyValueObservation`. Observation stops "when the returned NSKeyValueObservation is deinited or invalidated". [observe][kvo-observe] [invalidate()][kvo-invalidate] Change handlers run after the change unless `.prior` is passed, which adds a before-change notification. That option exists for observers that must call their own `willChange…` for a dependent property. [prior][kvo-prior] SE-0395 says KVO "lacks in composability", and its events are "still stringly typed". [SE-0395][se0395]

**NotificationCenter** is "a notification dispatch mechanism that enables the broadcast of information to registered observers". It can filter by name and an optional source object. [NotificationCenter][nc] Block-based `addObserver(forName:object:queue:using:)` returns an opaque token that the center "strongly holds … until you remove the observer registration". Apple recommends weak `self` in the block to avoid a retain cycle. [addObserver(forName:)][nc-add] Selector-based observers no longer need removal since iOS 9 / macOS 10.11. [addObserver(_:selector:)][nc-add-selector] `notifications(named:object:)` returns an `AsyncSequence` for `for await`. [notifications(named:)][nc-async]

## 5. `AsyncStream` as a subscription primitive

`AsyncStream` is "well-suited to adapt callback- or delegation-based APIs". The producer calls `yield`/`finish`, and its `BufferingPolicy` is `unbounded` (the default), `bufferingOldest(n)` or `bufferingNewest(n)`. [AsyncStream][asyncstream] [SE-0314][se0314] `onTermination` runs when iteration is cancelled, before the iterator yields `nil`, which is where the producer stops monitoring. [onTermination][onterm] For a "something changed, re-pull" signal, `bufferingNewest(1)` drops redundant signals in the same way that `Observations` drops intermediate values.

## 6. Swift Evolution

- **SE-0395 Observability** (Swift 5.9): `@Observable`, `ObservationRegistrar`, `withObservationTracking`. It explains the move away from KVO (`NSObject` only) and from Combine ("restricted to Darwin platforms and does not use current Swift concurrency features"). Async sequences of coalesced transactions were removed from this proposal and deferred. [SE-0395][se0395]
- **SE-0475 Transactional Observation of Values** (Swift 6.2): `Observations`. [SE-0475][se0475]
- **SE-0506 Advanced Observation Tracking** (Swift 6.4): `didSet`/`deinit` options and continuous tracking. [SE-0506][se0506]
- **SE-0314 AsyncStream** (Swift 5.5): the bridge from delegate/callback APIs to `AsyncSequence`. [SE-0314][se0314]
- No Swift Evolution proposal formally deprecates or replaces Combine. The closest statements are SE-0395's motivation and the Observation migration article. [SE-0395][se0395] [Migrating to Observable][migrate]

## 7. Implications for nn

Current code: each [`Entity`](../../../packages/entities/src/Entity.ts) owns an `EventEmitter`, and `emit("change")` bumps `revision`. [`LWWMap`](../../../packages/entities/src/LWWMap.ts) and [`RGA`](../../../packages/entities/src/RGA.ts) keep `Map<key, Unsubscribe>` closures per child. [`State`](../../../packages/store/src/State.ts) subscribes to each top-level field, invalidates its [`View`](../../../packages/store/src/View.ts), and publishes a `ReadonlySet` of names through [`Batch`](../../../packages/store/src/Batch.ts). [`Store`](../../../packages/store/src/Store.ts) is State's only internal subscriber, and it ignores `remote`. [`HttpRemote`](../../../packages/http-remote/src/HttpRemote.ts) exposes a public emitter, while [`Remote.subscribe()`](../../../packages/remote/src/Remote.ts) takes no callback.

| Link            | Fits Apple's                                                                       | Why                                                                                                                                                                                                                                                                                                                                   |
| --------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Entity → parent | Delegate (`weak var delegate`, sender first, `did`)                                | One owner, synchronous, and the parent must update its own revision before anyone reads. SE-0506 cites this exact case as needing immediate `didSet`. Sender-first replaces the per-child closure map: `entityDidChange(child)` lets one method serve N children.                                                                     |
| State → Store   | Delegate, then broadcast (`UIApplicationDelegate` + `didBecomeActiveNotification`) | Store owns State and is the one party allowed to act (persist). React listeners come after. Calling `stateDidChange(state, changed)` before emitting to listeners matches UIKit's documented order.                                                                                                                                   |
| Remote → Store  | Delegate, or `AsyncStream`-style iterator                                          | Exactly one consumer, events are async, and teardown must close the `EventSource`. `connect(delegate): Unsubscribe` is a delegate plus a KVO/`AnyCancellable`-style token. An async iterator with `return()` closing the source mirrors `onTermination`. Update signals are idempotent, so coalescing (`bufferingNewest(1)`) is safe. |
| Store → React   | Observer set (NotificationCenter / Combine subject / registrar)                    | N observers, so a delegate slot cannot serve. `useSyncExternalStore` needs `subscribe(listener) → unsubscribe`, which is token-based removal. The `changed` set is a coarse analogue of the registrar's key-path index. Per-property tracking like SwiftUI's is the auto-tracking question, not a delegate question.                  |

### Timing: did, not will

Every link above should notify **after** the mutation. React's `useSyncExternalStore` calls `getSnapshot` to check whether the snapshot changed when the subscribed callback fires. A will-change notification would see the old snapshot and could skip the render. `View` also depends on `revision` being bumped before `materialize` runs. Combine's `objectWillChange` works for SwiftUI only because SwiftUI defers reading to a later render. SE-0395 calls that behaviour surprising, and SE-0506 adds `didSet` for synchronous consumers. [SE-0395][se0395] [SE-0506][se0506] See also [legend-state-usesyncexternalstore-and-getsnapshot.md](legend-state-usesyncexternalstore-and-getsnapshot.md). Reserve `will`/`should` names for hooks that can veto or prepare, such as rejecting a remote merge. Don't use them for change notifications.

### Coalescing

`Batch` already implements the transaction idea from SE-0475: open on the first change, deliver once when the outermost synchronous run ends. The SE-0475 transaction instead ends at the next suspension point. [ADR-05](../../decisions/ADR-05-batch-store-notifications.md) and [notification-batching.md](notification-batching.md) cover the synchronous boundary. If remote merges or other async writes need grouping, SE-0475's "close at the next suspension point" is the precedent for a microtask boundary. That boundary belongs at State/Store, not inside entities. Entity→parent should stay uncoalesced so revisions are correct before any read, which is SE-0506's argument.

### Weak references and lifetime

- **Does not translate:** `weak var delegate` exists to break reference-counting cycles. JavaScript GC collects a parent↔child cycle, so a plain strong `delegate` field is correct. `WeakRef` would make delivery depend on GC timing.
- **Does translate:** detachment. Apple ties unsubscription to `deinit` (`AnyCancellable`, `NSKeyValueObservation`), and JavaScript has no deterministic equivalent. When `RGA.remove` or `LWWMap`'s `current` setter replaces a child, the old child's delegate must be cleared explicitly. Otherwise a detached child that is still mutated elsewhere keeps notifying its former parent. The same applies to `Remote.connect`: the returned `Unsubscribe` is the only teardown.

### Single-owner enforcement

Apple doesn't enforce it: assigning `delegate` silently replaces the previous one. For a CRDT tree, two parents for one entity is a model error, not a reconfiguration, so the proposal's choice to throw when a delegate is already set is stricter than Apple's and appropriate. Allow reassignment only after the old owner clears it.

### Sender first, and what else to pass

`entityDidChange(child)` follows the Cocoa sender-first rule. However, State currently needs the **top-level field name** to build `changed` and persist one entry. If State becomes the delegate of the root `LWWMap` alone, then `entityDidChange(root)` loses the name. If State delegates each field directly, the fields' owner is State, not the root map, which breaks single ownership. Apple's answer is a second argument naming what changed, as in `tableView(_:didSelectRowAt:)`. Options are a map-specific `map(_:didChangeField:)` delegate method or `entityDidChange(entity, child)`. The design should choose one before replacing the subscriptions.

## Could not verify

- Apple's `withObservationTracking` page does not state willSet timing or one-shot behaviour. Both are taken from the Swift source and SE-0395's "first change" wording.
- The Swift book page did not render through the fetcher, so its text was read from `swiftlang/swift-book` `main`, which may be ahead of the published book.
- No Apple document states why `objectWillChange` is will-based. The rationale given here is inference.
- I found no Apple multicast-delegate API. That is an absence in the docs consulted, not an Apple statement.
- The "Delegation" glossary and _Coding Guidelines for Cocoa_ are archived pages that Apple marks as possibly outdated. UIKit's current `weak var delegate` declarations confirm the memory rule.
- The claim that React's `useSyncExternalStore` calls `getSnapshot` when the listener fires comes from React's documented contract and the linked repo note, not from rereading React source in this research.

## References

- Delegation: [Coding Guidelines for Cocoa][cocoa-naming], [Cocoa Delegation][cocoa-delegation], [Swift book Protocols][tspl-protocols], [API Design Guidelines][api-guidelines], [UITableView.delegate][uitv-delegate], [UITableView.dataSource][uitv-datasource], [didSelectRowAt][uitv-didselect], [willSelectRowAt][uitv-willselect], [applicationDidBecomeActive][uiapp-active].
- Observation: [Observable()][observable-macro], [withObservationTracking][wot-doc], [Observations][observations-doc], [ObservationRegistrar.swift][registrar-src], [ObservationTracking.swift][tracking-src], [WWDC23 10149][wwdc23], [Migrating to Observable][migrate], [Managing model data][model-data].
- Swift Evolution: [SE-0314][se0314], [SE-0395][se0395], [SE-0475][se0475], [SE-0506][se0506].
- Combine: [ObservableObject][observableobject], [Published][published], [PassthroughSubject][pts], [CurrentValueSubject][cvs], [AnyCancellable][anycancellable].
- KVO and notifications: [Using KVO in Swift][kvo-guide], [observe][kvo-observe], [invalidate()][kvo-invalidate], [prior][kvo-prior], [NotificationCenter][nc], [addObserver(forName:)][nc-add], [addObserver(_:selector:)][nc-add-selector], [notifications(named:)][nc-async].
- Concurrency: [AsyncStream][asyncstream], [onTermination][onterm].

[cocoa-naming]: https://developer.apple.com/library/archive/documentation/Cocoa/Conceptual/CodingGuidelines/Articles/NamingMethods.html
[cocoa-delegation]: https://developer.apple.com/library/archive/documentation/General/Conceptual/DevPedia-CocoaCore/Delegation.html
[tspl-protocols]: https://github.com/swiftlang/swift-book/blob/main/TSPL.docc/LanguageGuide/Protocols.md
[api-guidelines]: https://www.swift.org/documentation/api-design-guidelines/
[uitv-delegate]: https://developer.apple.com/documentation/uikit/uitableview/delegate
[uitv-datasource]: https://developer.apple.com/documentation/uikit/uitableview/datasource
[uitv-didselect]: https://developer.apple.com/documentation/uikit/uitableviewdelegate/tableview(_:didselectrowat:)
[uitv-willselect]: https://developer.apple.com/documentation/uikit/uitableviewdelegate/tableview(_:willselectrowat:)
[uiapp-active]: https://developer.apple.com/documentation/uikit/uiapplicationdelegate/applicationdidbecomeactive(_:)
[observable-macro]: https://developer.apple.com/documentation/observation/observable()
[wot-doc]: https://developer.apple.com/documentation/observation/withobservationtracking(_:onchange:)
[observations-doc]: https://developer.apple.com/documentation/observation/observations
[registrar-src]: https://github.com/swiftlang/swift/blob/07e58307a49a1f69f9c9def374462c4e7bd93128/stdlib/public/Observation/Sources/Observation/ObservationRegistrar.swift
[tracking-src]: https://github.com/swiftlang/swift/blob/9d6a4f17bc864c8232b2d3d9a9b0bf93fc89738c/stdlib/public/Observation/Sources/Observation/ObservationTracking.swift#L132-L142
[se0395]: https://github.com/swiftlang/swift-evolution/blob/main/proposals/0395-observability.md
[se0475]: https://github.com/swiftlang/swift-evolution/blob/main/proposals/0475-observed.md
[se0506]: https://github.com/swiftlang/swift-evolution/blob/main/proposals/0506-advanced-observation-tracking.md
[se0314]: https://github.com/swiftlang/swift-evolution/blob/main/proposals/0314-async-stream.md
[wwdc23]: https://developer.apple.com/videos/play/wwdc2023/10149/
[migrate]: https://developer.apple.com/documentation/swiftui/migrating-from-the-observable-object-protocol-to-the-observable-macro
[model-data]: https://developer.apple.com/documentation/swiftui/managing-model-data-in-your-app
[observableobject]: https://developer.apple.com/documentation/combine/observableobject
[published]: https://developer.apple.com/documentation/combine/published
[pts]: https://developer.apple.com/documentation/combine/passthroughsubject
[cvs]: https://developer.apple.com/documentation/combine/currentvaluesubject
[anycancellable]: https://developer.apple.com/documentation/combine/anycancellable
[kvo-guide]: https://developer.apple.com/documentation/swift/using-key-value-observing-in-swift
[kvo-observe]: https://developer.apple.com/documentation/objectivec/nsobject-swift.class/observe(_:options:changehandler:)
[kvo-invalidate]: https://developer.apple.com/documentation/foundation/nskeyvalueobservation/invalidate()
[kvo-prior]: https://developer.apple.com/documentation/foundation/nskeyvalueobservingoptions/prior
[nc]: https://developer.apple.com/documentation/foundation/notificationcenter
[nc-add]: https://developer.apple.com/documentation/foundation/notificationcenter/addobserver(forname:object:queue:using:)
[nc-add-selector]: https://developer.apple.com/documentation/foundation/notificationcenter/addobserver(_:selector:name:object:)
[nc-async]: https://developer.apple.com/documentation/foundation/notificationcenter/notifications(named:object:)
[asyncstream]: https://developer.apple.com/documentation/swift/asyncstream
[onterm]: https://developer.apple.com/documentation/swift/asyncstream/continuation/ontermination
