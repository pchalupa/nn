# @goodstate/entities

[Conflict-free replicated data types](https://crdt.tech/) that a store keeps its state in.

## Installation

```sh
npm install @goodstate/entities
```

## Usage

A conflict-free replicated data type (CRDT) is a value that several replicas can change independently and later merge into the same result. `LWWRegister` holds a single value and keeps the last write.

```ts
import { LWWRegister } from "@goodstate/entities/kinds/lww-register";

const local = new LWWRegister("draft");
const remote = new LWWRegister("published");

local.merge(remote);

local.current;
```

### Composing entities

`LWWMap` holds named entities and `RGA` holds an ordered list of them.

```ts
import { LWWMap } from "@goodstate/entities/kinds/lww-map";
import { LWWRegister } from "@goodstate/entities/kinds/lww-register";
import { RGA } from "@goodstate/entities/kinds/rga";

const todos = new RGA([new LWWMap({ title: new LWWRegister("Write README") })]);

todos.push(new LWWMap({ title: new LWWRegister("Publish") }));
```

Items you take out with `remove` stay removed when replicas merge, and a removed key can't be added again.

### Encoding and decoding

`Codec` turns any entity into a serializable form and back.

```ts
import type { Encoded } from "@goodstate/entities/codable";
import { Codec } from "@goodstate/entities/codec";
import { Entity } from "@goodstate/entities/entity";

const codec = new Codec();
const encoded: Encoded = codec.encode(todos);
const decoded: Entity = codec.decode(JSON.parse(JSON.stringify(encoded)));
```
