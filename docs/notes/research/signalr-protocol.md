# The ASP.NET Core SignalR protocol, and what it means for `@nn/sync-engine`

SignalR is Microsoft's RPC-over-a-persistent-connection stack: a connection layer that negotiates and runs one of three transports, and a hub protocol on top that carries method calls, results and streams in both directions. This note reads it from its own specs, its server and TypeScript client code, and the Microsoft Learn pages. It covers negotiation, the transports, the hub messages and their encodings, keep-alive, automatic reconnect, the newer stateful reconnect, and exactly which delivery guarantees each of those gives. The second half maps the protocol onto [`SyncEngine`][engine], says where SignalR's guarantees fall short of what a local-first sync engine needs, what is worth borrowing even without SignalR, and which gaps in the current engine API this exposes.

Researched **2026-11-12** against `dotnet/aspnetcore` `main` at commit **`5b17720d700658e104d9962c1898fc0e6df15b03`** (committed 2026-11-12, `src/SignalR/clients/ts/signalr/package.json` version `12.0.0-dev`), and `dotnet/AspNetCore.Docs` `main` at commit **`e4dccc27340c261c36ca3b21641c8913986bf5b5`** (committed 2026-11-12), which is the source of the Microsoft Learn SignalR pages. Both were read from shallow sparse clones of `src/SignalR` and `aspnetcore/signalr`. No code from either clone was run. Every `file:line` for SignalR refers to those commits. Learn pages carry version-specific sections; the quotes below come from the newest moniker range. Local code refers to this repository at `5cbdc3f` (2026-11-11). Statements marked **Inference** are mine, not a source's.

## Sources

- Specs in `dotnet/aspnetcore@5b17720d`, `src/SignalR/docs/specs/` (the only two files there):
  - [`HubProtocol.md`][spec-hub]: messages, invocation rules, JSON and MessagePack encodings, framing
  - [`TransportProtocols.md`][spec-transport]: `/negotiate`, transports, transfer formats, `/refresh`
- TypeScript client, `src/SignalR/clients/ts/`:
  - [`HubConnection.ts`][ts-hub]: state machine, `invoke`/`send`/`stream`, keep-alive, server timeout, automatic reconnect, client results
  - [`HttpConnection.ts`][ts-http]: negotiate, redirects, transport selection and fallback, stateful reconnect at the transport level, send queue
  - [`MessageBuffer.ts`][ts-buffer]: client side of stateful reconnect
  - [`DefaultReconnectPolicy.ts`][ts-retry], [`IRetryPolicy.ts`][ts-iretry], [`HubConnectionBuilder.ts`][ts-builder], [`IStatefulReconnectOptions.ts`][ts-stateful-options]
  - [`TextMessageFormat.ts`][ts-text], [`JsonHubProtocol.ts`][ts-json], [`BinaryMessageFormat.ts`][ts-binary], [`MessagePackHubProtocol.ts`][ts-msgpack]
  - [`ServerSentEventsTransport.ts`][ts-sse], [`WebSocketTransport.ts`][ts-ws]
- Server, `src/SignalR/`:
  - [`common/Shared/MessageBuffer.cs`][srv-buffer]: server side of stateful reconnect
  - [`server/Core/src/HubConnectionContext.cs`][srv-context]: handshake, keep-alive tick, client timeout, write failures
  - [`server/Core/src/HubOptions.cs`][srv-options], [`HubOptionsSetup.cs`][srv-options-setup], [`HubConnectionContextOptions.cs`][srv-context-options]
  - [`server/Core/src/Internal/DefaultHubDispatcher.cs`][srv-dispatcher], [`Internal/ChannelBasedSemaphore.cs`][srv-semaphore]
  - [`common/Http.Connections/src/Internal/HttpConnectionDispatcher.cs`][http-dispatcher], [`HttpConnectionManager.cs`][http-manager], [`HttpConnectionContext.cs`][http-context], [`HttpConnectionDispatcherOptions.cs`][http-options], [`ConnectionOptionsSetup.cs`][conn-options-setup]
  - [`common/Http.Connections.Common/src/NegotiateProtocol.cs`][negotiate-protocol], [`common/Protocols.Json/src/Protocol/JsonHubProtocol.cs`][json-cs]
  - [`server/StackExchangeRedis/src/RedisHubLifetimeManager.cs`][redis-cs]
- Microsoft Learn (source in `dotnet/AspNetCore.Docs@e4dccc27`, `aspnetcore/signalr/`):
  - [Overview][learn-intro] ([`introduction.md`][d-intro]), [JavaScript client][learn-js] ([`javascript-client.md`][d-js]), [Configuration][learn-config] ([`configuration.md`][d-config]), [Hubs][learn-hubs] ([`hubs.md`][d-hubs]), [Groups][learn-groups] ([`groups.md`][d-groups]), [Scale][learn-scale] ([`scale.md`][d-scale]), [Redis backplane][learn-redis] ([`redis-backplane.md`][d-redis]), [Streaming][learn-streaming] ([`streaming.md`][d-streaming])
- This repository: [`sync-engine.ts`][engine], [`session.ts`][session], [`sync-engine.test.ts`][engine-test], [`session.test.ts`][session-test], [`README.md`][readme], [`sse-sync.ts`][sse-sync], [`event-stream.ts`][event-stream], [ADR-16][adr16], [ADR-17][adr17], and the notes [Local-first architecture][lfa], [CRDT deltas][crdt-deltas], [Hybrid logical clocks][hlc]

## Short answer

- **SignalR guarantees per-connection order and nothing about delivery.** The hub protocol "requires" a reliable, in-order transport and "provides no facility for retransmission or reordering of messages" [`HubProtocol.md:11-15`][spec-hub]. A message in flight when a connection dies is lost. A pending `invoke` is rejected with "Invocation canceled due to the underlying connection being closed." [`HubConnection.ts:905`][ts-hub], so the caller cannot tell whether the server ran it. My summary: **at most once, in order, per connection**.
- **Automatic reconnect is a new connection, not a resumed one.** It retries after 0, 2, 10 and 30 s by default, then gives up [`DefaultReconnectPolicy.ts:7`][ts-retry]. "Because the connection looks entirely new to the server, a new `connectionId` is provided" [`javascript-client.md:195`][d-js]. Group membership is lost too [`groups.md:42`][d-groups].
- **Stateful reconnect (.NET 8+) resumes the same connection after a short drop.** Both sides buffer "invocation" messages until acknowledged. On reconnect they send a `Sequence` message and replay the buffer, and the receiver drops duplicates by sequence number [`MessageBuffer.ts:33-175`][ts-buffer] · [`MessageBuffer.cs:151-334`][srv-buffer]. Within one logical connection that gives at-least-once resend with deduplication. It is WebSockets-only [`HttpConnection.ts:597`][ts-http], makes one immediate reconnect attempt [`HttpConnection.ts:554-573`][ts-http], has a 100,000-byte buffer by default [`HubOptions.cs:92`][srv-options], keeps buffers only in process memory, and lasts only as long as the server keeps the inactive connection (15 s `DisconnectTimeout` by default) [`ConnectionOptionsSetup.cs:17`][conn-options-setup] · [`HttpConnectionManager.cs:240-252`][http-manager].
- **Nothing in SignalR survives a page reload, a server restart, or a failover to another server.** Groups "won't persist through a server restart" [`groups.md:44`][d-groups]. With the Redis backplane, "Any messages sent while the Redis server is down are lost" [`redis-backplane.md:76`][d-redis].
- **Mapping onto `SyncEngine` is direct.** `open` builds and `start()`s a `HubConnection`, `close` stops it, `onclose` becomes `session.drop()` as in `SseSync`, `push` is `invoke("Push", name, entry)`, `pull` is `invoke("Pull", name)` or a snapshot, and a client method calls `receive` (§11).
- **The engine already compensates for most of what SignalR lacks.** Entities are state-based CRDTs, and every connection pulls every field and pushes every field [`sync-engine.ts:17-44`][engine] · [ADR-16][adr16]. Re-sending current state subsumes lost and duplicated pushes, and the pull covers anything missed during a gap. So SignalR's at-most-once delivery is acceptable for `@nn`. The cost is O(state) per reconnect. This rests on the server merging what it receives, which the example server does not do ([Local-first architecture §8.2][lfa]). **Inference.**
- **SignalR adds two things over `SseSync`.** One ordered duplex channel, on which the server by default runs one invocation per client at a time (`MaximumParallelInvocationsPerClient = 1`, [`configuration.md:77`][d-config]). That closes, within a connection, the out-of-order push race noted in ADR-16 [ADR-16:81][adr16]. It also brings keep-alive with timeouts on both sides (15 s ping, 30 s timeout) [`HubOptionsSetup.cs:15-19`][srv-options-setup] · [`HubConnection.ts:16-17`][ts-hub]. **Inference** for the race claim; I read the code, the order is not documented.
- **Recommended shape:** do not enable `withAutomaticReconnect`. The engine's own `Disconnected` → `retry()` lifecycle ([ADR-17][adr17]) already owns recovery, and it pulls and pushes everything on each attempt. Optionally enable stateful reconnect to absorb short blips without the engine noticing. **Inference.**
- **SignalR's message size limit and whole-root pushes conflict.** The server's default `MaximumReceiveMessageSize` is 32 KB, and a message over it aborts the connection [`configuration.md:76, 102`][d-config]. `SyncEngine` pushes each top-level field whole, tombstones included ([Local-first architecture §8.2][lfa]). A large `RGA` root would exceed it. **Inference.**
- **Worth borrowing without SignalR:** the pure `IRetryPolicy` shape (`{previousRetryCount, elapsedMilliseconds, retryReason} → delay | null`); the keep-alive rules (ping only when idle, timeout at twice the interval, reset on any traffic); a cumulative-ack idea, reduced to a per-field "last acknowledged" marker so a reconnect pushes only fields changed since then; `invoke` vs `send` as an explicit "applied" vs "sent" contract; and `Close { allowReconnect }` as a way for a server to tell a client whether to retry (§13).
- **Gaps this exposes in the engine API:** no "resync without closing" hook; `push` has no connection signal and no defined meaning for its promise; per-field `pull` costs N sequential round trips; no cursor reaches `open` or `pull`; no way for a transport to say "do not retry"; and pending pushes rejected by a dropped connection surface as `onError` noise (§14).
- **The spec and the code disagree in three places.** The spec names the negotiate flag `useAck`; the code uses `useStatefulReconnect`. The spec says the handshake `version` is always 1; stateful reconnect needs version 2. The spec's link to the "ack protocol" is a `#todo`. Stateful reconnect has no normative spec, only code and one Learn section (§15).

---

## 1. Two layers

SignalR is two protocols stacked:

- **The connection layer** (`Microsoft.AspNetCore.Http.Connections`, [`TransportProtocols.md`][spec-transport]): `POST /negotiate`, then WebSockets, Server-Sent Events plus HTTP POST, or Long Polling plus HTTP POST. It moves opaque frames and knows nothing of methods.
- **The hub protocol** ([`HubProtocol.md`][spec-hub]): "a protocol for two-way RPC over any Message-based transport. Either party in the connection may invoke procedures on the other party, and procedures can return zero or more results or an error" [`HubProtocol.md:3`][spec-hub].

The spec's terms are **Caller** and **Callee**, and "a node can be both Caller and Callee for different invocations simultaneously" [`HubProtocol.md:7-8`][spec-hub]. The server calling a client and waiting for its result ("client results") is the same protocol with the roles reversed.

## 2. Negotiation

### The request and the version

The client sends `POST [endpoint-base]/negotiate?negotiateVersion=N`. The server answers with the requested version if it supports it, its highest version if the client asked for more, or an error if the client asked for less than its minimum [`TransportProtocols.md:19-29`][spec-transport]. The TS client always asks for version 1 [`HttpConnection.ts:83, 708-710`][ts-http].

A version 1 response looks like this [`TransportProtocols.md:39-71`][spec-transport]:

```json
{
	"connectionToken": "05265228-1e2c-46c5-82a1-6a5bcc3f0143",
	"connectionId": "807809a5-31bf-470d-9e23-afaee35d8a0d",
	"negotiateVersion": 1,
	"availableTransports": [
		{ "transport": "WebSockets", "transferFormats": ["Text", "Binary"] },
		{ "transport": "ServerSentEvents", "transferFormats": ["Text"] },
		{ "transport": "LongPolling", "transferFormats": ["Text", "Binary"] }
	]
}
```

Unknown properties must be ignored, "This allows for future additions without breaking older clients" [`TransportProtocols.md:37`][spec-transport].

### `connectionId` vs `connectionToken`

- `connectionToken` goes in the `id` query string of every transport request, and in the `X-SignalR-Connection-Token` header for authentication refresh. "This value should be kept secret" [`TransportProtocols.md:41`][spec-transport]. It is "**required** by the Long Polling and Server-Sent Events transports (in order to correlate sends and receives)" [`TransportProtocols.md:68`][spec-transport].
- `connectionId` "is the id by which other clients can refer to it" [`TransportProtocols.md:69`][spec-transport]: it is what an app passes to `Clients.Client(id)`.
- Version 0 had only `connectionId`, used as the `id`. The TS client copies `connectionId` into `connectionToken` for version 0 so the rest of its code needs only one field [`HttpConnection.ts:356-360`][ts-http].

The split exists so that one client cannot hijack another's connection by learning its public ID. **Inference** from "kept secret" and "by which other clients can refer to it".

### Redirects (Azure SignalR Service)

A negotiate response may instead be `{ "url": …, "accessToken": … }`, telling the client to connect elsewhere with an optional bearer token [`TransportProtocols.md:107-121`][spec-transport]. This is how the Azure SignalR Service works: "Each time a client initiates a connection to the server, the client is redirected to connect to the service" [`scale.md:58`][d-scale]. The TS client follows up to 100 redirects, replacing its access token with the one returned [`HttpConnection.ts:45, 269-300`][ts-http].

### Skipping negotiation

With `skipNegotiation`, the TS client opens a WebSocket straight to the endpoint with no `id`, and refuses any other transport: "Negotiation can only be skipped when using the WebSocket transport directly" [`HttpConnection.ts:255-264`][ts-http]. The spec allows this because WebSockets "is a persistent connection that can be established in a single operation" [`TransportProtocols.md:150`][spec-transport]. The trade-offs:

- No sticky sessions are needed, because there is only one request [`scale.md:20-24`][d-scale].
- It "can't be enabled when using the Azure SignalR Service" [`configuration.md:440`][d-config].
- `onreconnected` receives `undefined` as the connection ID [`javascript-client.md:197`][d-js].
- Stateful reconnect is never enabled, because the flag is set only while choosing a transport from a negotiate response, which this path never does [`HttpConnection.ts:255-264, 597`][ts-http]. **Inference** from the code.

### Authentication refresh

New in the spec: a version 1 connection can `POST [endpoint-base]/refresh` with its token in the `X-SignalR-Connection-Token` header to re-authenticate without reconnecting [`TransportProtocols.md:136-140`][spec-transport]. The TS client exposes it as `refreshAuthentication()` [`HubConnection.ts:642-669`][ts-hub]. It is in the Learn docs from the `aspnetcore-11.0` moniker on [`javascript-client.md:343-345`][d-js]. It does not affect delivery, so this note does not cover it further.

## 3. Transports

### Requirements and the three transports

A transport must be duplex, binary-safe and text-safe; WebSockets is the only one that is duplex on its own. The others are "half-transports" combined with HTTP POST for client-to-server [`TransportProtocols.md:5-13`][spec-transport].

| Transport          | Direction       | Framing and rules                                                                                                                                                                                                                                                                                       | Source                                                |
| ------------------ | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| WebSockets         | full duplex     | WebSocket opcode marks Text or Binary. Missing `id` creates a new connection; unknown `id` is `404`; a second WebSocket on one connection is `409 Conflict`. Unexpected errors close with a non-`1000` code.                                                                                            | [`TransportProtocols.md:148-156`][spec-transport]     |
| HTTP POST          | client → server | Mandatory `id`. The server answers `200` only after processing the **entire** payload. A second POST while one is outstanding is rejected with `409`, and the connection stays open. Any other non-200 means the connection is gone.                                                                    | [`TransportProtocols.md:158-168`][spec-transport]     |
| Server-Sent Events | server → client | Unnamed events, so only `data` is used. Text only, so no MessagePack. `\r\n` may become `\n`.                                                                                                                                                                                                           | [`TransportProtocols.md:11, 170-193`][spec-transport] |
| Long Polling       | server → client | The client re-polls immediately after each response. A new poll terminates the previous one with `204`, and "Any messages which have already been written to the existing request will be flushed and considered sent". An idle timeout returns `200` with an empty body. `DELETE` ends the connection. | [`TransportProtocols.md:195-213`][spec-transport]     |

Two details matter for delivery:

- **Client-to-server order holds on the HTTP transports too.** The TS client funnels every send through a `TransportSendQueue` that concatenates buffered frames and awaits each `transport.send` before the next [`HttpConnection.ts:739-806`][ts-http]. That serializes POSTs, which the server's one-POST-at-a-time rule requires.
- **Long Polling marks messages "sent" when written, not when received.** If a poll response is written but lost before the client reads it, nothing resends it. **Inference** from "considered sent" [`TransportProtocols.md:199`][spec-transport].

### Fallback order

The Learn overview lists WebSockets, Server-Sent Events and Long Polling "in order of graceful fallback" [`introduction.md:44-50`][d-intro]. In code:

- The server builds `availableTransports` in exactly that order, filtered by `options.Transports` and by whether the server has WebSockets [`HttpConnectionDispatcher.cs:634-647`][http-dispatcher].
- The client walks the list in order. It skips a transport the client disabled, one its environment lacks (`WebSocket`, `EventSource`), or one that lacks the transfer format the protocol needs [`HttpConnection.ts:489-529, 580-612`][ts-http].
- If a transport fails to start, the client throws away that negotiate response and negotiates again before trying the next transport, because the token belongs to the failed attempt [`HttpConnection.ts:500-516`][ts-http].

Fallback happens only at connection start. A connection never switches transport while it runs. **Inference** from the code: the only transport choice is in `_createTransport`, called from `_startInternal` [`HttpConnection.ts:302`][ts-http].

## 4. The hub protocol

### Handshake

The first client message must be a `HandshakeRequest`, `{ "protocol": "json" | "messagepack", "version": … }`. It is always JSON and always terminated by `0x1E`, whatever protocol it selects. The server replies with a `HandshakeResponse`, `{}` or `{ "error": … }`, and closes the connection if it does not support the protocol [`HubProtocol.md:37-63`][spec-hub]. The server closes connections that do not complete the handshake within `HandshakeTimeout`, 15 s by default [`HubOptionsSetup.cs:15`][srv-options-setup] · [`configuration.md:71`][d-config].

### Message types

| Type               | JSON `type` | Sent by | Purpose                                                                                            | Source                               |
| ------------------ | ----------- | ------- | -------------------------------------------------------------------------------------------------- | ------------------------------------ |
| `Invocation`       | 1           | Caller  | call `target` with `arguments`; optional `invocationId`, optional `streamIds` for uploads          | [`HubProtocol.md:317-367`][spec-hub] |
| `StreamItem`       | 2           | either  | one item of a server-to-client stream, or of an upload stream                                      | [`HubProtocol.md:393-409`][spec-hub] |
| `Completion`       | 3           | either  | ends an invocation or stream, with `result` or `error`, never both                                 | [`HubProtocol.md:411-460`][spec-hub] |
| `StreamInvocation` | 4           | Caller  | call a method that streams results                                                                 | [`HubProtocol.md:369-391`][spec-hub] |
| `CancelInvocation` | 5           | Caller  | stop a stream or ask the Callee to cancel an invocation                                            | [`HubProtocol.md:462-474`][spec-hub] |
| `Ping`             | 6           | either  | keep-alive; no payload                                                                             | [`HubProtocol.md:476-486`][spec-hub] |
| `Close`            | 7           | either  | close, with optional `error` and `allowReconnect`                                                  | [`HubProtocol.md:488-517`][spec-hub] |
| `Ack`              | 8           | either  | "how many trackable messages have been received"                                                   | [`HubProtocol.md:519-531`][spec-hub] |
| `Sequence`         | 9           | either  | first message after a reconnect: the sequence ID the sender restarts at; "Only sent on reconnects" | [`HubProtocol.md:533-545`][spec-hub] |

All messages except `Ping` may carry string-to-string `headers`. No headers are defined, so receivers must accept and ignore them [`HubProtocol.md:90-92`][spec-hub]. A missing required field or an unrecognized field is a protocol error, and the other side "may immediately terminate the underlying connection" [`HubProtocol.md:126-128`][spec-hub].

### Invocation IDs, blocking and non-blocking

- The Caller picks an invocation ID, an arbitrary string unique per connection, and the Callee echoes it on every response [`HubProtocol.md:75-88`][spec-hub]. Reusing an ID one's own side already used is a protocol error, but each side has its own ID space [`HubProtocol.md:133`][spec-hub].
- An `Invocation` **without** an ID is non-blocking: "the caller does not expect a response … it **must not** send any response" [`HubProtocol.md:94-96`][spec-hub]. That is the TS client's `send()`, which marks the invocation non-blocking [`HubConnection.ts:468-475`][ts-hub].
- An `Invocation` **with** an ID is answered by exactly one `Completion`. A single-result method "**MUST** not send any `StreamItem` messages" [`HubProtocol.md:116-120`][spec-hub]. That is `invoke()`, which resolves with `result` or rejects with `error` [`HubConnection.ts:488-523`][ts-hub].
- Receiving anything for an ID after its `Completion` is a protocol error [`HubProtocol.md:118`][spec-hub].

What the promises mean, per Learn: `invoke` "is resolved with the return value (if any) when the method on the server returns" [`javascript-client.md:113`][d-js]. `send` "is resolved when the message is sent to the server", and "Using `send` _**doesn't**_ wait until the server receives the message" [`javascript-client.md:115-117`][d-js]. In code, without stateful reconnect `send` resolves when the transport send resolves [`HubConnection.ts:451-456`][ts-hub]. With stateful reconnect it can resolve earlier (§8).

### Cancellation

- A stream: the Caller sends `CancelInvocation`. The Callee stops sending items and sends a `Completion`, which the Caller may ignore [`HubProtocol.md:104`][spec-hub].
- A non-streaming invocation: the Callee may honour the request, for example by cancelling a `CancellationToken` parameter, but "**MUST** still send a `Completion`" [`HubProtocol.md:106-110`][spec-hub]. The TS client sends `CancelInvocation` only for streams, from `ISubscription.dispose()` [`HubConnection.ts:403-411`][ts-hub]; `invoke` takes no cancellation argument.

### Streaming in both directions

- **Server to client:** `StreamInvocation`, then `StreamItem`s, then a `Completion`. An error `Completion` does not discard items already received; they are dispatched first [`HubProtocol.md:98-104, 122-124`][spec-hub]. The TS `stream()` returns a `Subject` [`HubConnection.ts:395-440`][ts-hub]. Hub methods return `IAsyncEnumerable<T>` or `ChannelReader<T>`, with a `CancellationToken` "triggered when the client unsubscribes" [`streaming.md:24, 39`][d-streaming].
- **Client to server (upload):** the Caller adds `streamIds` to an `Invocation` or `StreamInvocation`, sends `StreamItem`s with the stream ID in `invocationId`, and ends each stream with a `Completion` [`HubProtocol.md:112-114`][spec-hub]. The TS client does this for any `Subject` argument [`HubConnection.ts:1228-1262`][ts-hub].
- Streams do not count against `MaximumParallelInvocationsPerClient` [`HubOptions.cs:59-66`][srv-options] · [`DefaultHubDispatcher.cs:352-365`][srv-dispatcher].

### Client results

The server can call `Clients.Client(id).InvokeAsync<T>(…)` or `Clients.Caller.InvokeAsync<T>(…)` and await a value returned from the client's `.on` handler, with a `CancellationToken` bounding the wait [`hubs.md:221-223`][d-hubs]. On the wire this is an `Invocation` with an ID sent from server to client. The TS client:

- runs every handler registered for the method and keeps the last result;
- sends an error `Completion` with "Client didn't provide a result." when there is no handler or no result;
- sends "Client provided multiple results." when two handlers return values;
- sends the exception text if a handler throws [`HubConnection.ts:834-891`][ts-hub].

## 5. Encodings and transfer formats

**JSON.** Each message is one JSON object followed by `0x1E` (ASCII record separator). Property names are case-sensitive and UTF-8 is used on the ASP.NET transports [`HubProtocol.md:311-315`][spec-hub]. The TS reader requires the buffer to end in `0x1E`, splits on it, and drops the empty tail [`TextMessageFormat.ts:6-22`][ts-text]. Byte arrays become Base64 strings [`HubProtocol.md:1009`][spec-hub].

**MessagePack.** Each message is a MessagePack array whose first element is the type, for example `[1, Headers, InvocationId, Target, [Arguments], [StreamIds]]` [`HubProtocol.md:571-592`][spec-hub]. Frames are `([Length][Body])…`, where `Length` is a VarInt of 1 to 5 bytes, least significant group first, with the high bit as a continuation marker, capped at 2 GB [`HubProtocol.md:1014-1034`][spec-hub]. The TS reader enforces the 5-byte cap and throws "Messages bigger than 2GB are not supported." [`BinaryMessageFormat.ts:35-54`][ts-binary]. A `Ping` is always exactly `0x91 0x06` and carries no headers [`HubProtocol.md:952-957`][spec-hub].

**Transfer formats.** `Text` is UTF-8, `Binary` is arbitrary bytes [`TransportProtocols.md:142-146`][spec-transport]. The JSON protocol declares `Text` and MessagePack declares `Binary` [`JsonHubProtocol.ts:21`][ts-json] · [`MessagePackHubProtocol.ts:31`][ts-msgpack]. Server-Sent Events advertises only `Text` [`TransportProtocols.md:191`][spec-transport], and the TS SSE transport rejects any other format [`ServerSentEventsTransport.ts:50-53`][ts-sse]. **MessagePack therefore never runs over SSE**; with WebSockets unavailable it falls back straight to Long Polling.

**Values.** Both encodings carry values that "need not be self-describing, because when decoding the value, the Binder is expected to know the destination type" [`HubProtocol.md:567-569`][spec-hub]. The type table is "informative guidance", not normative [`HubProtocol.md:995-997`][spec-hub].

## 6. Keep-alive and timeouts

The spec makes `Ping` optional and one-way: either side may send it, the receiver "has no obligation to respond", and "A `Ping` is only sent if the interval has elapsed without a message being sent" [`HubProtocol.md:135-146`][spec-hub]. The defaults:

| Setting                           | Side                     | Default | Meaning                                                                                                                       | Source                                                                                                    |
| --------------------------------- | ------------------------ | ------- | ----------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `KeepAliveInterval`               | server                   | 15 s    | ping the client if nothing was sent for this long                                                                             | [`HubOptionsSetup.cs:17`][srv-options-setup] · [`configuration.md:72`][d-config]                          |
| `ClientTimeoutInterval`           | server                   | 30 s    | abort if nothing, ping included, was received; recommended 2 × `KeepAliveInterval`                                            | [`HubOptionsSetup.cs:19`][srv-options-setup] · [`configuration.md:70`][d-config]                          |
| `HandshakeTimeout`                | server                   | 15 s    | close if no handshake arrives                                                                                                 | [`HubOptionsSetup.cs:15`][srv-options-setup]                                                              |
| `keepAliveIntervalInMilliseconds` | TS client                | 15,000  | ping the server if nothing was sent for this long                                                                             | [`HubConnection.ts:17, 138`][ts-hub]                                                                      |
| `serverTimeoutInMilliseconds`     | TS client                | 30,000  | stop the connection if nothing was received; "at least double the server's keep-alive interval"                               | [`HubConnection.ts:16, 137`][ts-hub] · [`configuration.md:344-345`][d-config]                             |
| `DisconnectTimeout`               | server, connection layer | 15 s    | how long an inactive connection (Long Polling between polls, or a stateful-reconnect connection whose socket dropped) is kept | [`ConnectionOptionsSetup.cs:17`][conn-options-setup] · [`HttpConnectionManager.cs:240-252`][http-manager] |

How the code implements it:

- **Server.** A heartbeat tick sends a `Ping` when the time since the last send exceeds `KeepAliveInterval`. To save work it records the send time only on that tick, so the true ping rate can be up to one tick slower [`HubConnectionContext.cs:815-838`][srv-context]. A separate check aborts with "Client hasn't sent a message/ping within the configured ClientTimeoutInterval" [`HubConnectionContext.cs:850-870`][srv-context]. That abort allows a reconnect [`HubConnectionContext.cs:618-635`][srv-context].
- **TS client.** Every send pushes the next ping time back [`HubConnection.ts:782-792`][ts-hub]. The ping and server-timeout timers are re-armed from the receive path ("set from a networking callback to avoid Chrome timer throttling"), and an overdue ping is sent at once [`HubConnection.ts:794-824`][ts-hub]. When the server timeout fires, the client calls `connection.stop(error)`, which "could trigger reconnecting" [`HubConnection.ts:827-832`][ts-hub].
- **Long Polling** has "inherent keep-alive", so neither pings nor the server timeout apply [`HttpConnection.ts:306-308`][ts-http] · [`HubConnection.ts:783-785, 795`][ts-hub].
- **The browser.** The client logs a warning on the page `freeze` event, because a frozen tab "will likely lead to the connection being closed and messages being lost" [`HubConnection.ts:87, 222-225`][ts-hub]. Learn suggests holding a Web Lock to keep the tab awake [`javascript-client.md:302-340`][d-js].

## 7. Automatic reconnect in the TypeScript client

### States

`HubConnectionState` has five values: `Disconnected`, `Connecting`, `Connected`, `Disconnecting`, `Reconnecting` [`HubConnection.ts:28-38`][ts-hub]. `start()` is legal only from `Disconnected`, goes through `Connecting`, and ends in `Connected` or back in `Disconnected` with a rejected promise [`HubConnection.ts:206-235`][ts-hub].

### Policy

`withAutomaticReconnect()` installs `DefaultReconnectPolicy`, whose delays are `[0, 2000, 10000, 30000, null]`: four attempts, then stop [`DefaultReconnectPolicy.ts:7-19`][ts-retry] · [`HubConnectionBuilder.ts:178-190`][ts-builder]. An array of delays replaces the defaults. An `IRetryPolicy` object gives full control:

```ts
interface IRetryPolicy {
	nextRetryDelayInMilliseconds(retryContext: RetryContext): number | null;
}
interface RetryContext {
	readonly previousRetryCount: number;
	readonly elapsedMilliseconds: number;
	readonly retryReason: Error;
}
```

[`IRetryPolicy.ts:5-30`][ts-iretry]. Returning `null` stops retrying, and a policy that throws is treated as `null` [`HubConnection.ts:1034-1045`][ts-hub]. Automatic reconnect is off unless configured, and it "doesn't configure the `HubConnection` to retry initial start failures" [`javascript-client.md:163, 211`][d-js].

### The loop

When the underlying connection closes while `Connected` with a policy set [`HubConnection.ts:893-918`][ts-hub]:

1. Every pending `invoke` and `stream` callback is rejected with the close error or "Invocation canceled due to the underlying connection being closed." [`HubConnection.ts:905, 1161-1173`][ts-hub].
2. The policy is asked for the first delay. `null` closes for good [`HubConnection.ts:953-959`][ts-hub].
3. The state becomes `Reconnecting` and the `onreconnecting` callbacks run. If one of them calls `stop()`, the loop ends [`HubConnection.ts:961-981`][ts-hub].
4. After each delay, the client runs the full start sequence again: negotiate, transport and handshake [`HubConnection.ts:983-997`][ts-hub].
5. On success: `Connected`, then `onreconnected(connectionId)` [`HubConnection.ts:999-1010`][ts-hub]. On failure: count, ask the policy again. When the policy returns `null`: `Disconnected`, then `onclose` [`HubConnection.ts:1011-1031`][ts-hub].

A `Close` message from the server with `allowReconnect: true` stops the transport so that this loop runs. Without the flag the client stops for good [`HubConnection.ts:715-731`][ts-hub]. The server sets it when it aborts in a way that allows reconnecting, for example after a failed write or a client timeout [`HubConnectionContext.cs:410-418, 618-635`][srv-context].

### What it does and does not preserve

The reconnected connection "looks entirely new to the server", so it gets a new `connectionId` [`javascript-client.md:195`][d-js]. Nothing that was in flight is replayed: the pending invocations were rejected in step 1. Server-to-client messages sent while the client was away are not delivered later, because the server addressed the old connection. Groups must be rejoined [`groups.md:42`][d-groups]. **Inference**, combining the cited behaviour: automatic reconnect restores the pipe, and recovering what was missed is the application's job.

## 8. Stateful reconnect

### What Learn says

Stateful reconnect "reduces the perceived downtime of clients that have a temporary disconnect", by "Temporarily buffering data on the server and client", "Acknowledging messages received (ACK-ing) by both the server and client" and "Recognizing when a connection is up and replaying messages that might be sent while the connection is down". It needs .NET 8 or later, `AllowStatefulReconnects = true` on the endpoint, and `withStatefulReconnect({ bufferSize })` on the client, with 100,000 bytes as the default buffer on both sides [`configuration.md:367-415`][d-config] · [`HttpConnectionDispatcherOptions.cs:128-134`][http-options] · [`HubOptions.cs:88-92`][srv-options].

### Negotiation and handshake

- The client adds `useStatefulReconnect=true` to the negotiate URL [`HttpConnection.ts:712-718`][ts-http]. The server agrees only if `AllowStatefulReconnects` is set, and answers `"useStatefulReconnect": true` [`HttpConnectionDispatcher.cs:560-571, 615`][http-dispatcher] · [`NegotiateProtocol.cs:37`][negotiate-protocol]. A client that did not ask but gets `true` back fails the negotiation [`HttpConnection.ts:362-364`][ts-http].
- The feature is enabled only when the chosen transport is WebSockets [`HttpConnection.ts:597`][ts-http] · [`HttpConnectionContext.cs:1025`][http-context].
- The hub protocol version must be 2. Both JSON and MessagePack declare version 2 [`JsonHubProtocol.ts:18`][ts-json] · [`JsonHubProtocol.cs:50`][json-cs]. The TS client sends version 1 when the feature was not negotiated, to keep older servers working [`HubConnection.ts:249-254`][ts-hub]. The server disables the feature for a handshake below version 2 [`HubConnectionContext.cs:733-746`][srv-context].

### The buffer, acks and sequence numbers

Both sides implement the same algorithm, with small differences ([`MessageBuffer.ts`][ts-buffer], [`MessageBuffer.cs`][srv-buffer]):

- **Only "invocation-class" messages are tracked:** `Invocation`, `StreamItem`, `Completion`, `StreamInvocation`, `CancelInvocation`. `Ping`, `Close`, `Ack` and `Sequence` are not buffered or counted [`MessageBuffer.ts:186-205`][ts-buffer] · [`MessageBuffer.cs:182-194, 255-260`][srv-buffer].
- **Sending.** Each tracked message gets the next ID, starting at 1, and is kept in the buffer until acknowledged [`MessageBuffer.ts:19-21, 39-59`][ts-buffer] · [`MessageBuffer.cs:46-50, 182-187`][srv-buffer].
- **Receiving.** The receiver counts tracked messages. A message whose ID is not above the highest already received is a duplicate and is dropped [`MessageBuffer.ts:104-137`][ts-buffer] · [`MessageBuffer.cs:232-273`][srv-buffer].
- **Acks are cumulative and batched.** The client arms a 1-second timer when a message arrives and then acks the highest ID received [`MessageBuffer.ts:133-135, 207-222`][ts-buffer]. The server acks on a 1-second periodic timer when there is something new [`MessageBuffer.cs:24, 94-127`][srv-buffer]. An `Ack` removes every buffered message up to that ID [`MessageBuffer.ts:75-102`][ts-buffer] · [`MessageBuffer.cs:204-230`][srv-buffer].
- **Backpressure.**
  - Client: once the buffered size reaches `bufferSize`, the promise from `send`/`invoke`'s send step does not resolve until acks bring it back under the limit [`MessageBuffer.ts:50-55, 72, 88-92`][ts-buffer]. For JSON the "byte" count is the JavaScript string length, so UTF-16 code units, not bytes [`MessageBuffer.ts:44-48`][ts-buffer]. **Inference** from the code.
  - Server: a write over the limit waits for an ack for at most 5 s [`MessageBuffer.cs:22, 151-166`][srv-buffer]. A failed write aborts the connection with reconnect allowed [`HubConnectionContext.cs:410-418`][srv-context].
- **Reconnect.** The side that resends first sends `Sequence { sequenceId }`, the ID of the first unacknowledged message, or the next ID if nothing is pending. It then resends the buffer in order [`MessageBuffer.ts:161-175`][ts-buffer] · [`MessageBuffer.cs:275-334`][srv-buffer]. The receiver resets its expected ID to that value. It rejects a value below 1 or above what it has seen, and closes the connection [`MessageBuffer.ts:139-154`][ts-buffer] · [`MessageBuffer.cs:234-253`][srv-buffer]. While waiting for the `Sequence`, the client processes nothing else [`MessageBuffer.ts:105-112`][ts-buffer].

The spec states the message shapes and one sentence of semantics: "Duplicate messages are possible to receive and should be ignored" [`HubProtocol.md:35`][spec-hub].

### The reconnect itself

- **Client.** When a WebSocket with stateful reconnect closes, the client marks the buffer as reconnecting, reconnects the **same transport to the same URL**, so the same `connectionToken`, and resends. If that one attempt fails, it falls back to the ordinary close path [`HttpConnection.ts:554-573`][ts-http]. There is no delay or retry loop at this level. During the attempt, `HubConnection` stays `Connected`, no `onreconnecting` fires, and pending `invoke` promises are not rejected, because `onclose` has not run. **Inference** from the code: `_cancelCallbacksWithError` runs only from `_connectionClosed` [`HubConnection.ts:893-905`][ts-hub].
- **Server.** On an ungraceful close of a stateful-reconnect WebSocket, the server marks the connection inactive instead of disposing it [`HttpConnectionDispatcher.cs:491-506`][http-dispatcher] · [`HttpConnectionContext.cs:1222-1225`][http-context]. A reconnect with the same `id` reattaches it and triggers the resend [`HttpConnectionDispatcher.cs:406-419`][http-dispatcher]. The manager disposes an inactive connection after `DisconnectTimeout`, 15 s by default [`HttpConnectionManager.cs:240-252`][http-manager] · [`ConnectionOptionsSetup.cs:17`][conn-options-setup]. A reconnect to a server that no longer has the connection gets `404` [`TransportProtocols.md:152`][spec-transport].

### Messages in flight: what is and is not covered

| Situation                                                                                                                | Outcome                                                                                                                                                  | Source                                                                                                   |
| ------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Socket drops; the client reconnects within `DisconnectTimeout` to the same server process                                | Unacknowledged tracked messages are resent in both directions and duplicates dropped. Pending `invoke`s complete normally. The app sees no event.        | §8 above                                                                                                 |
| Client → server message sent while the client knows it is reconnecting                                                   | Buffered, not sent; resent after `Sequence`. The `send()` promise resolves once buffered, under the limit, not "when the message is sent" as Learn says. | [`MessageBuffer.ts:61-72`][ts-buffer] · [`javascript-client.md:115`][d-js]. **Inference** from the code. |
| A client transport send throws                                                                                           | Treated as a disconnect; the promise does not reject                                                                                                     | [`MessageBuffer.ts:69-71`][ts-buffer]                                                                    |
| The single client reconnect attempt fails, or the server timed the connection out, restarted, or is a different instance | Ordinary close: pending invocations rejected, buffers dropped; automatic reconnect, if configured, starts a **new** connection with a new buffer         | [`HttpConnection.ts:562-572`][ts-http] · [`HubConnection.ts:285-294, 905`][ts-hub]                       |
| Buffers survive a page reload or a server restart?                                                                       | No. Both are fields of in-memory objects tied to one connection.                                                                                         | [`HubConnection.ts:56, 287`][ts-hub] · [`HubConnectionContext.cs:40, 744`][srv-context]                  |
| Long Polling or SSE                                                                                                      | Not available                                                                                                                                            | [`HttpConnection.ts:597`][ts-http]                                                                       |

One more detail from the code, not tested: on the fallback path the old client buffer is replaced, and `_dispose` runs only in `_completeClose` [`HubConnection.ts:287, 927-934`][ts-hub]. A `send()` waiting on backpressure in the old buffer would then never settle. **Inference.**

## 9. Delivery guarantees, side by side

My characterization, built from §§3–8. The column headers are not SignalR's own terms.

| Property                              | Plain connection                                                                   | With automatic reconnect                                              | With stateful reconnect                                                        |
| ------------------------------------- | ---------------------------------------------------------------------------------- | --------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Order within one connection           | yes, both directions (requires an in-order transport; the client serializes sends) | per connection; nothing orders the old connection against the new one | yes, including across a resumed socket                                         |
| Loss on a transport drop              | in-flight messages lost; `invoke` outcome unknown                                  | same, then a new connection                                           | none within `DisconnectTimeout` on the same server process; otherwise as plain |
| Duplicates                            | none from SignalR; only if the app retries                                         | only if the app re-invokes after an unknown outcome                   | resends are deduplicated by sequence ID                                        |
| Server → client messages during a gap | lost                                                                               | lost (they targeted the old `connectionId`)                           | replayed if buffered and the resume succeeds                                   |
| Survives page reload                  | no                                                                                 | no                                                                    | no                                                                             |
| Survives server restart or failover   | no                                                                                 | no                                                                    | no                                                                             |
| Group membership after reconnect      | n/a                                                                                | lost, must rejoin                                                     | kept (same connection)                                                         |

So SignalR is **at most once per message**. Stateful reconnect raises that to effectively exactly once **within one logical connection**, and only while both processes and both buffers live. No mode gives durable, cross-session or cross-server delivery.

## 10. Groups, users and the backplane

- **Groups** are in memory. "Group membership isn't preserved when a connection reconnects", "Groups are kept in memory, so they won't persist through a server restart" [`groups.md:42-44`][d-groups]. A full reconnect has a new `connectionId`, so `OnConnectedAsync` has to re-add it.
- **Scale-out.** Without a backplane, "the message only goes to the clients connected to that server" [`scale.md:50`][d-scale]. All HTTP requests of one connection must reach the same server process, so sticky sessions are required except on one server, behind the Azure SignalR Service, or with WebSockets-only plus `SkipNegotiation` [`scale.md:18-26`][d-scale]. A stateful reconnect that a load balancer routes to a different instance gets `404` (§8). **Inference.**
- **Redis backplane.** Sends to all, a group or a user are Redis `PUBLISH`es on per-target channels [`RedisHubLifetimeManager.cs:144-197, 286-291`][redis-cs]. Group add and remove wait for an ack from the server that owns the connection [`RedisHubLifetimeManager.cs:200-228, 315-330`][redis-cs]. SignalR's docs: "SignalR doesn't buffer messages to send them when the server comes back up. Any messages sent while the Redis server is down are lost" [`redis-backplane.md:70-76`][d-redis].
- **Order across targets.** Sends to a group, a user and all clients go out on different Redis channels [`RedisHubLifetimeManager.cs:147, 180, 196`][redis-cs]. I found nothing that orders messages across channels, so a client in both a group and a user target should not assume relative order. **Inference.**
- **Azure SignalR Service** "functions as a proxy for real-time traffic and doubles as a backplane" [`scale.md:58`][d-scale]. Its delivery semantics were not in the sources read (§15).

---

## 11. A `SignalRSync` engine: how it maps onto the hooks

### The base class, briefly

[`SyncEngine`][engine] drives a five-state [`Session`][session]: `idle`, `connecting`, `connected`, `disconnected`, `disposed` [`session.ts:4-10`][session].

- **Connecting:** `open(signal)`, then `pull(name)` for each schema property in turn, merging each result [`sync-engine.ts:17-29`][engine]. A throw before the signal aborts is reported and drops the session [`sync-engine.ts:30-35`][engine].
- **Connected:** push every encoded field once, then subscribe to store changes and push each change [`sync-engine.ts:37-44`][engine].
- **Leaving a live state:** unsubscribe, then `close()` [`sync-engine.ts:45-48`][engine] · [`session.ts:89-95`][session].
- **Failures:** a failed push is reported and the engine stays connected [`sync-engine.ts:109-119`][engine] · [`README.md:64`][readme]. Pushes run concurrently, even for the same field [`sync-engine.test.ts:361`][engine-test] · [ADR-16][adr16].
- **Recovery:** `disconnected` is left only by `retry()`, which apps call from wake signals [`session.ts:150-151`][session] · [ADR-17][adr17]. A subclass can `drop()` or `reopen()` [`session.ts:67-77`][session].

### Mapping

| Engine              | SignalR                                                     | Notes                                                                                                                                                                                                                                                                                                                                                                                                     |
| ------------------- | ----------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `open(signal)`      | build a `HubConnection`, register handlers, `await start()` | `start()` takes no signal. Aborting is covered because `Session` calls `close()` right after aborting [`session.ts:89-95`][session], and `stop()` during `start()` rejects it [`HttpConnection.ts:271-274`][ts-http]. A failed `start()` does not fire `onclose` [`HubConnection.ts:927-929`][ts-hub], so it is reported once, as a failed attempt.                                                       |
| `close()`           | `stop()`                                                    | `stop()` on a stopped connection is ignored [`HubConnection.ts:335-344`][ts-hub].                                                                                                                                                                                                                                                                                                                         |
| transport lost      | `onclose` → `this.session.drop()`                           | The same pattern `SseSync` uses [`sse-sync.ts:30`][sse-sync]. Guard against the `onclose` of a connection the engine itself stopped: `onclose` fires asynchronously after `stop()` [`HubConnection.ts:927-946`][ts-hub]. If the engine is already `connecting` a new attempt, a stale `drop` would end that attempt (`connecting` + `drop` → `disconnected`, [`session.ts:141`][session]). **Inference.** |
| `push(name, entry)` | `invoke("Push", name, entry)`                               | `invoke` resolves when the hub method returns, so a resolved push means "applied". `send` would mean only "handed to the transport" or "buffered" (§4, §8).                                                                                                                                                                                                                                               |
| `pull(name)`        | `invoke<unknown>("Pull", name)`                             | One round trip per field, sequential [`sync-engine.ts:22-28`][engine]. Alternatives: one `invoke("Snapshot")` in `open`, passed to `receive`, which is what `SseSync` does with its first event [`event-stream.ts:18-32`][event-stream]; or a `stream("Snapshot")` for large state.                                                                                                                       |
| `receive(entries)`  | `connection.on("Receive", …)`                               | `receive` throws on an undecodable entry [`sync-engine.test.ts:601`][engine-test]. The SignalR client catches and only logs handler exceptions [`HubConnection.ts:867-870`][ts-hub], so the subclass must catch and report to `this.errors`, as `EventStream` does [`event-stream.ts:34-40`][event-stream].                                                                                               |
| connection health   | keep-alive and server timeout                               | Built in (§6). A dead socket becomes `onclose` within `serverTimeoutInMilliseconds`, and then `drop()`.                                                                                                                                                                                                                                                                                                   |

### Automatic reconnect: leave it off

If the subclass enabled `withAutomaticReconnect`, SignalR would sit in `Reconnecting` while the engine still believed it was `connected`. Pushes during that window reject with "Cannot send data if the connection is not in the 'Connected' State." [`HttpConnection.ts:174-177`][ts-http], are reported, and are not retried until the field changes [`sync-engine.ts:113-116`][engine]. After `onreconnected` the engine would have to pull and push everything again to cover the gap. The only engine primitive that does that is `reopen()`, which closes and reopens the transport [`session.ts:147`][session] · [`sync-engine.test.ts:537`][engine-test], so it would stop the connection SignalR just restored. The two state machines would fight.

The consistent design is to map `onclose` → `drop()` and let the app's `retry()` start a new attempt. That attempt pulls and pushes every field, which is exactly the catch-up SignalR does not provide (§12). **Inference.**

Stateful reconnect does not conflict. It hides short WebSocket drops below `HubConnection` (§8), so the engine never sees them, and it ends in an ordinary `onclose` when it fails. Turning it on saves a full pull and push-all for blips under `DisconnectTimeout`. **Inference.**

### Sketch

Illustrative, not compiled or tested. It assumes a hub with `Pull(name)` and `Push(name, entry)` methods that merge server-side, and that calls `Receive(entries)` on the other clients.

```ts
import { type HubConnection, HubConnectionBuilder } from "@microsoft/signalr";
import type { Encoded } from "@nn/entities/codable";
import { assertPlainObject } from "@nn/guards/assert-plain-object";
import type { Store } from "@nn/store";
import { SyncEngine } from "@nn/sync-engine";

export class SignalRSync extends SyncEngine {
	private connection?: HubConnection;

	constructor(
		store: Store,
		private readonly url: string,
	) {
		super(store);
	}

	protected async open(): Promise<void> {
		const connection = new HubConnectionBuilder().withUrl(this.url).withStatefulReconnect().build();

		this.connection = connection;
		connection.on("Receive", (entries: unknown) => this.deliver(entries));
		connection.onclose(() => {
			if (this.connection === connection) this.session.drop();
		});

		await connection.start();
	}

	protected close(): void {
		const connection = this.connection;

		this.connection = undefined;
		void connection?.stop();
	}

	protected async pull(name: string): Promise<unknown> {
		return this.hub().invoke<unknown>("Pull", name);
	}

	protected async push(name: string, entry: Encoded): Promise<void> {
		await this.hub().invoke<void>("Push", name, entry);
	}

	private hub(): HubConnection {
		if (!this.connection) throw new Error(`Not connected to ${this.url}`);

		return this.connection;
	}

	private deliver(entries: unknown): void {
		try {
			assertPlainObject(entries, `Unexpected entries from ${this.url}`);
			this.receive(entries);
		} catch (error) {
			this.errors.notify(error);
		}
	}
}
```

Server-side contract the sketch relies on, stated in prose:

- `Push` decodes the entry, **merges** it into the stored root rather than replacing it, and sends the merged root to `Clients.Others` (or `OthersInGroup` for the store's scope).
- `Pull` returns the stored encoded root, or nothing.
- `OnConnectedAsync` adds the connection to its groups, because membership does not survive a reconnect [`groups.md:42`][d-groups].

Sending to `Others` keeps the pushing client from receiving its own change back. Without it, nothing breaks: the merge is a no-op and `receive` pushes back only when the store actually changed [`sync-engine.test.ts:469`][engine-test]. **Inference.**

## 12. Where SignalR falls short for local-first sync, and what fills the gap

| Need                               | SignalR                                                                                                                                                                      | `@nn` today                                                                                                                                                                                                  | What has to be added                                                                                                                                                                                                                      |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Offline queue / durable outbox** | None. The stateful-reconnect buffer is in memory, per connection, 100 kB by default, and dropped on full reconnect (§8).                                                     | None by design: the store is the outbox, and each connection pushes every field ([ADR-16][adr16], "Keep a persisted outbox" rejected). Durability across reloads comes from running `IndexDbSync` alongside. | Nothing, while the wire unit is whole CRDT state. A move to deltas or operations would need a durable outbox with idempotency keys ([Local-first architecture §4.2][lfa]).                                                                |
| **Idempotency**                    | Deduplication only inside one stateful connection. A full reconnect leaves `invoke` outcomes unknown [`HubConnection.ts:905`][ts-hub].                                       | `merge` of state-based CRDTs is idempotent, so re-pushing current state is safe [ADR-16][adr16].                                                                                                             | The **server must merge**, not replace. The example server replaces ([Local-first architecture §8.2][lfa]), so a re-push of an older value can regress its copy.                                                                          |
| **Catch-up after a gap**           | None. Server-to-client sends during a gap are lost (§9).                                                                                                                     | Every connection pulls every field, a full snapshot ([Local-first architecture §8.2][lfa]).                                                                                                                  | Correct but O(state). To make it O(changes), send a cursor (per-root HLC or a version vector) in `open` or `pull`, and have the server return only newer roots ([Local-first architecture §8.3 item 2][lfa], [CRDT deltas][crdt-deltas]). |
| **Ordering across reconnects**     | Per connection only. An `invoke` from the old connection may still be running on the server when the new connection's push of the same field arrives. **Inference.**         | Pushes of one field are not serialized [ADR-16][adr16].                                                                                                                                                      | A merging server makes order irrelevant for CRDT state. Otherwise a per-field version check that rejects older writes.                                                                                                                    |
| **Ordering within a connection**   | One ordered channel, and by default one non-streaming invocation per client at a time [`configuration.md:77`][d-config] · [`ChannelBasedSemaphore.cs:43-58`][srv-semaphore]. | `SseSync` sends concurrent independent `fetch` POSTs, which can arrive out of order [ADR-16:81][adr16].                                                                                                      | Nothing: SignalR closes the per-connection race. That they run in arrival order is my reading of the dispatcher, not a documented guarantee (§15).                                                                                        |
| **Server restart / failover**      | All connection state, groups and buffers are lost (§9, §10). Redis loses messages published while it is down [`redis-backplane.md:76`][d-redis].                             | The next `retry()` pulls and pushes everything, so clients heal.                                                                                                                                             | A durable server store. Nothing at the SignalR level can help.                                                                                                                                                                            |
| **Liveness**                       | Keep-alive and timeouts on both sides (§6).                                                                                                                                  | `SseSync` relies on `EventSource`, which reports only a close [`event-stream.ts:41-43`][event-stream].                                                                                                       | Nothing for SignalR.                                                                                                                                                                                                                      |
| **Message size**                   | 32 KB default inbound limit; over it the connection is aborted [`configuration.md:76, 102`][d-config].                                                                       | Each push is a whole root, tombstones included ([Local-first architecture §8.2][lfa]).                                                                                                                       | Raise `MaximumReceiveMessageSize`, use an upload stream (§4), or move to deltas. **Inference.**                                                                                                                                           |
| **Authorization of writes**        | Hub methods run with the user's identity, so a `Push` can refuse.                                                                                                            | No path for a server to reject a write except `onError` ([Local-first architecture §8.3 item 4][lfa]).                                                                                                       | A refused `invoke` rejects, and the engine reports it. Nothing yet tells the app that a field is permanently rejected.                                                                                                                    |

### What stateful reconnect solves, and what it does not

It solves:

- short WebSocket drops (network switch, brief loss) without losing or duplicating invocation-class messages in either direction;
- keeping pending `invoke`s alive through the drop;
- keeping the same `connectionId`, and with it group membership;
- all of that invisibly to `HubConnection`, and therefore to the engine.

It does not solve:

- drops longer than `DisconnectTimeout` (15 s default);
- a page reload, tab discard or browser restart;
- a server restart, redeploy, or a load balancer sending the reconnect to another instance;
- SSE and Long Polling, or `skipNegotiation`;
- traffic over the stateful buffer limit (it applies backpressure instead);
- loss in the backplane;
- anything that needs durable storage.

For `@nn` it is an optimisation that skips a pull and push-all on short blips. Correctness still rests on the engine's connect-time pull and push. **Inference.**

## 13. What is worth borrowing, even without SignalR

These are suggestions, not decisions; each would need an ADR.

1. **The retry policy as a pure function.** `nextRetryDelayInMilliseconds({ previousRetryCount, elapsedMilliseconds, retryReason }) → number | null` [`IRetryPolicy.ts:5-30`][ts-iretry]. [ADR-17][adr17] rejected timers inside engines. A pure policy can be tested without fake timers, and an app or a small helper could apply it to `onStateChange(Disconnected)` without changing that decision. `RetryContext` also names the three facts any backoff needs.
2. **Keep-alive rules.** Ping only after a quiet interval, time out at twice the peer's interval, and reset on any traffic [`HubProtocol.md:146`][spec-hub] · [`configuration.md:70-72`][d-config]. A future WebSocket engine could follow them, and `SseSync` could adopt server comment pings plus a client-side timeout that calls `drop()`. Arming timers from receive callbacks to dodge background-tab throttling is a useful detail [`HubConnection.ts:816`][ts-hub].
3. **Acknowledgements, reduced to what CRDT state needs.** SignalR numbers messages because it must replay them. `@nn` does not have to replay old states; the current state subsumes them. The useful part is the **cumulative ack**: if the server acknowledged "field `tickets` at version v" (for example its HLC), a reconnect could push only fields whose version moved since. That replaces "push every field" with "push every unacknowledged field" without a stored outbox. **Inference.**
4. **"Applied" vs "sent".** `invoke` vs `send` makes the promise meaning explicit [`javascript-client.md:113-117`][d-js]. `SyncEngine.push` returns `Promise<void>` with no stated meaning. `SseSync.push` resolves even on a non-OK response and reports instead [`sse-sync.ts:49`][sse-sync].
5. **A server-side "may retry" flag.** `Close { error, allowReconnect }` lets the server tell the client whether a retry is useful [`HubProtocol.md:488-517`][spec-hub] · [`HubConnection.ts:715-731`][ts-hub]. The engine has one failure state, and `retry()` always leaves it.
6. **A version handshake.** SignalR rejects an unsupported protocol in the first exchange [`HubProtocol.md:37`][spec-hub]. A schema version exchanged at `open` is one answer to the "no schema versioning" gap ([Local-first architecture §8.3 item 7][lfa]).
7. **Transport fallback: probably not.** WebSockets and `EventSource` are available in every browser `@nn` targets, and `SseSync` already uses the SSE-plus-POST combination SignalR falls back to. The negotiate-then-fallback machinery adds a round trip and sticky-session requirements [`scale.md:18-26`][d-scale]. **Inference.**

## 14. Gaps in the current `SyncEngine` API that this exposes

Observations, not proposed changes.

- **No "resync without closing".** A transport that recovers on its own, such as SignalR's automatic reconnect, has no way to ask the engine to pull and push everything again on the same connection. `reopen()` always calls `close()` and `open()` [`session.ts:110-113, 147`][session].
- **No signal for `push`.** `open` gets the attempt's `AbortSignal` but `push` does not [ADR-16][adr16]. When a connection drops, SignalR rejects every pending `invoke` [`HubConnection.ts:905`][ts-hub], and each rejection reaches `onError` [`sync-engine.ts:113-116`][engine], even though the drop is also signalled and the next connection re-pushes everything. With a signal, the engine could tell "the connection ended" from "the server refused".
- **The `push` promise has no defined meaning.** It could mean sent, received, or applied. The engine treats a rejection as "reported, not retried until the field changes" [`README.md:64`][readme]. That is correct only if a rejection means the server definitely did not apply the push, which an unknown `invoke` outcome does not tell you.
- **Per-field `pull` only.** `pull` runs once per schema property, sequentially [`sync-engine.ts:22-28`][engine]. A transport that can fetch everything in one round trip has to do it inside `open` and call `receive`, as `SseSync` does [`event-stream.ts:18-32`][event-stream].
- **No cursor.** Nothing passes "what I already have" to `open` or `pull`, so catch-up is always a full snapshot ([Local-first architecture §8.3 item 2][lfa]).
- **No way to say "do not retry".** A subclass can only `drop()`, which leads to the same `disconnected` state that `retry()` leaves [`session.ts:150-151`][session]. A server that says "stop", such as SignalR's `Close` without `allowReconnect` or a `401`, looks the same as a network blip.
- **No backpressure on the initial push.** Connecting pushes every field at once with `Promise.all` [`sync-engine.ts:110-118`][engine]. Over SignalR, that is many concurrent `invoke`s queued behind `MaximumParallelInvocationsPerClient = 1`. Under stateful reconnect they can also hit the buffer limit (§8). **Inference.**

## 15. Spec–code discrepancies, and what I could not verify

### The spec and the code disagree

- **Negotiate flag name.** The spec says the client sends `useAck=true` and the server answers `"useAck": "true"` [`TransportProtocols.md:31-33`][spec-transport]. The client sends `useStatefulReconnect=true` [`HttpConnection.ts:712-718`][ts-http]. The server reads `UseStatefulReconnect` and writes `"useStatefulReconnect"` [`HttpConnectionDispatcher.cs:560-565`][http-dispatcher] · [`NegotiateProtocol.cs:37`][negotiate-protocol].
- **Handshake version.** The spec says `version` "must always be 1, for both MessagePack and Json protocols" [`HubProtocol.md:42`][spec-hub]. Both protocols are at version 2, and stateful reconnect requires it (§8).
- **No normative spec for stateful reconnect.** The spec links to the "[ack protocol](#todo)" [`TransportProtocols.md:33`][spec-transport]. The only semantics in `HubProtocol.md` are the message shapes and one sentence [`HubProtocol.md:34-35`][spec-hub]. Everything in §8 is read from code and one Learn section.
- **`send()` under stateful reconnect.** Learn says the promise "is resolved when the message is sent" [`javascript-client.md:115`][d-js]. With stateful reconnect it resolves once buffered, even while reconnecting, and a transport send error does not reject it [`MessageBuffer.ts:61-72`][ts-buffer]. **Inference** from the code.

### Not verified

- **Azure SignalR Service:** whether it supports stateful reconnect, and its delivery and ordering semantics. Those live in the Azure docs, which I did not read; nothing in `dotnet/aspnetcore` or the ASP.NET Core Learn pages states them.
- **Strict FIFO execution of one client's invocations.** I read it from `ChannelBasedSemaphore` with capacity 1 [`ChannelBasedSemaphore.cs:15-54`][srv-semaphore] and `DefaultHubDispatcher` [`DefaultHubDispatcher.cs:352-365`][srv-dispatcher]. Learn documents only the concurrency limit [`configuration.md:77`][d-config], not order. I did not trace the receive loop end to end.
- **Redis pub/sub semantics** (fire-and-forget, no persistence) come from Redis, not SignalR. Only SignalR's own statement that messages are lost while Redis is down is cited.
- **The hanging backpressure promise** on fallback from stateful to full reconnect (§8) is a code reading, not a test.
- The **.NET, Java and Swift clients** were not read. Everything client-side here is the TypeScript client.
- **Server behaviour for an in-flight hub method when its client disconnects** (whether it runs to completion) was not traced.

[spec-hub]: https://github.com/dotnet/aspnetcore/blob/5b17720d700658e104d9962c1898fc0e6df15b03/src/SignalR/docs/specs/HubProtocol.md
[spec-transport]: https://github.com/dotnet/aspnetcore/blob/5b17720d700658e104d9962c1898fc0e6df15b03/src/SignalR/docs/specs/TransportProtocols.md
[ts-hub]: https://github.com/dotnet/aspnetcore/blob/5b17720d700658e104d9962c1898fc0e6df15b03/src/SignalR/clients/ts/signalr/src/HubConnection.ts
[ts-http]: https://github.com/dotnet/aspnetcore/blob/5b17720d700658e104d9962c1898fc0e6df15b03/src/SignalR/clients/ts/signalr/src/HttpConnection.ts
[ts-buffer]: https://github.com/dotnet/aspnetcore/blob/5b17720d700658e104d9962c1898fc0e6df15b03/src/SignalR/clients/ts/signalr/src/MessageBuffer.ts
[ts-retry]: https://github.com/dotnet/aspnetcore/blob/5b17720d700658e104d9962c1898fc0e6df15b03/src/SignalR/clients/ts/signalr/src/DefaultReconnectPolicy.ts
[ts-iretry]: https://github.com/dotnet/aspnetcore/blob/5b17720d700658e104d9962c1898fc0e6df15b03/src/SignalR/clients/ts/signalr/src/IRetryPolicy.ts
[ts-builder]: https://github.com/dotnet/aspnetcore/blob/5b17720d700658e104d9962c1898fc0e6df15b03/src/SignalR/clients/ts/signalr/src/HubConnectionBuilder.ts
[ts-stateful-options]: https://github.com/dotnet/aspnetcore/blob/5b17720d700658e104d9962c1898fc0e6df15b03/src/SignalR/clients/ts/signalr/src/IStatefulReconnectOptions.ts
[ts-text]: https://github.com/dotnet/aspnetcore/blob/5b17720d700658e104d9962c1898fc0e6df15b03/src/SignalR/clients/ts/signalr/src/TextMessageFormat.ts
[ts-json]: https://github.com/dotnet/aspnetcore/blob/5b17720d700658e104d9962c1898fc0e6df15b03/src/SignalR/clients/ts/signalr/src/JsonHubProtocol.ts
[ts-binary]: https://github.com/dotnet/aspnetcore/blob/5b17720d700658e104d9962c1898fc0e6df15b03/src/SignalR/clients/ts/signalr-protocol-msgpack/src/BinaryMessageFormat.ts
[ts-msgpack]: https://github.com/dotnet/aspnetcore/blob/5b17720d700658e104d9962c1898fc0e6df15b03/src/SignalR/clients/ts/signalr-protocol-msgpack/src/MessagePackHubProtocol.ts
[ts-sse]: https://github.com/dotnet/aspnetcore/blob/5b17720d700658e104d9962c1898fc0e6df15b03/src/SignalR/clients/ts/signalr/src/ServerSentEventsTransport.ts
[ts-ws]: https://github.com/dotnet/aspnetcore/blob/5b17720d700658e104d9962c1898fc0e6df15b03/src/SignalR/clients/ts/signalr/src/WebSocketTransport.ts
[srv-buffer]: https://github.com/dotnet/aspnetcore/blob/5b17720d700658e104d9962c1898fc0e6df15b03/src/SignalR/common/Shared/MessageBuffer.cs
[srv-context]: https://github.com/dotnet/aspnetcore/blob/5b17720d700658e104d9962c1898fc0e6df15b03/src/SignalR/server/Core/src/HubConnectionContext.cs
[srv-options]: https://github.com/dotnet/aspnetcore/blob/5b17720d700658e104d9962c1898fc0e6df15b03/src/SignalR/server/Core/src/HubOptions.cs
[srv-options-setup]: https://github.com/dotnet/aspnetcore/blob/5b17720d700658e104d9962c1898fc0e6df15b03/src/SignalR/server/Core/src/HubOptionsSetup.cs
[srv-context-options]: https://github.com/dotnet/aspnetcore/blob/5b17720d700658e104d9962c1898fc0e6df15b03/src/SignalR/server/Core/src/HubConnectionContextOptions.cs
[srv-dispatcher]: https://github.com/dotnet/aspnetcore/blob/5b17720d700658e104d9962c1898fc0e6df15b03/src/SignalR/server/Core/src/Internal/DefaultHubDispatcher.cs
[srv-semaphore]: https://github.com/dotnet/aspnetcore/blob/5b17720d700658e104d9962c1898fc0e6df15b03/src/SignalR/server/Core/src/Internal/ChannelBasedSemaphore.cs
[http-dispatcher]: https://github.com/dotnet/aspnetcore/blob/5b17720d700658e104d9962c1898fc0e6df15b03/src/SignalR/common/Http.Connections/src/Internal/HttpConnectionDispatcher.cs
[http-manager]: https://github.com/dotnet/aspnetcore/blob/5b17720d700658e104d9962c1898fc0e6df15b03/src/SignalR/common/Http.Connections/src/Internal/HttpConnectionManager.cs
[http-context]: https://github.com/dotnet/aspnetcore/blob/5b17720d700658e104d9962c1898fc0e6df15b03/src/SignalR/common/Http.Connections/src/Internal/HttpConnectionContext.cs
[http-options]: https://github.com/dotnet/aspnetcore/blob/5b17720d700658e104d9962c1898fc0e6df15b03/src/SignalR/common/Http.Connections/src/HttpConnectionDispatcherOptions.cs
[conn-options-setup]: https://github.com/dotnet/aspnetcore/blob/5b17720d700658e104d9962c1898fc0e6df15b03/src/SignalR/common/Http.Connections/src/ConnectionOptionsSetup.cs
[negotiate-protocol]: https://github.com/dotnet/aspnetcore/blob/5b17720d700658e104d9962c1898fc0e6df15b03/src/SignalR/common/Http.Connections.Common/src/NegotiateProtocol.cs
[json-cs]: https://github.com/dotnet/aspnetcore/blob/5b17720d700658e104d9962c1898fc0e6df15b03/src/SignalR/common/Protocols.Json/src/Protocol/JsonHubProtocol.cs
[redis-cs]: https://github.com/dotnet/aspnetcore/blob/5b17720d700658e104d9962c1898fc0e6df15b03/src/SignalR/server/StackExchangeRedis/src/RedisHubLifetimeManager.cs
[learn-intro]: https://learn.microsoft.com/aspnet/core/signalr/introduction
[learn-js]: https://learn.microsoft.com/aspnet/core/signalr/javascript-client
[learn-config]: https://learn.microsoft.com/aspnet/core/signalr/configuration
[learn-hubs]: https://learn.microsoft.com/aspnet/core/signalr/hubs
[learn-groups]: https://learn.microsoft.com/aspnet/core/signalr/groups
[learn-scale]: https://learn.microsoft.com/aspnet/core/signalr/scale
[learn-redis]: https://learn.microsoft.com/aspnet/core/signalr/redis-backplane
[learn-streaming]: https://learn.microsoft.com/aspnet/core/signalr/streaming
[d-intro]: https://github.com/dotnet/AspNetCore.Docs/blob/e4dccc27340c261c36ca3b21641c8913986bf5b5/aspnetcore/signalr/introduction.md
[d-js]: https://github.com/dotnet/AspNetCore.Docs/blob/e4dccc27340c261c36ca3b21641c8913986bf5b5/aspnetcore/signalr/javascript-client.md
[d-config]: https://github.com/dotnet/AspNetCore.Docs/blob/e4dccc27340c261c36ca3b21641c8913986bf5b5/aspnetcore/signalr/configuration.md
[d-hubs]: https://github.com/dotnet/AspNetCore.Docs/blob/e4dccc27340c261c36ca3b21641c8913986bf5b5/aspnetcore/signalr/hubs.md
[d-groups]: https://github.com/dotnet/AspNetCore.Docs/blob/e4dccc27340c261c36ca3b21641c8913986bf5b5/aspnetcore/signalr/groups.md
[d-scale]: https://github.com/dotnet/AspNetCore.Docs/blob/e4dccc27340c261c36ca3b21641c8913986bf5b5/aspnetcore/signalr/scale.md
[d-redis]: https://github.com/dotnet/AspNetCore.Docs/blob/e4dccc27340c261c36ca3b21641c8913986bf5b5/aspnetcore/signalr/redis-backplane.md
[d-streaming]: https://github.com/dotnet/AspNetCore.Docs/blob/e4dccc27340c261c36ca3b21641c8913986bf5b5/aspnetcore/signalr/streaming.md
[engine]: ../../../packages/sync-engine/src/sync-engine.ts
[session]: ../../../packages/sync-engine/src/session.ts
[engine-test]: ../../../packages/sync-engine/src/sync-engine.test.ts
[session-test]: ../../../packages/sync-engine/src/session.test.ts
[readme]: ../../../packages/sync-engine/README.md
[sse-sync]: ../../../packages/sse-sync/src/sse-sync.ts
[event-stream]: ../../../packages/sse-sync/src/event-stream.ts
[adr16]: ../../decisions/ADR-16-give-sync-engines-a-connection-lifecycle.md
[adr17]: ../../decisions/ADR-17-retry-disconnected-engines-on-wake-signals.md
[lfa]: local-first-architecture.md
[crdt-deltas]: crdt-deltas.md
[hlc]: hybrid-logical-clocks.md
