# @nn/id

Local ID generation.

## Installation

```sh
npm install @nn/id
```

## Usage

```ts
import { ID } from "@nn/id";

const id = ID.create();
```

`ID.create` returns a [UUID v4](https://www.rfc-editor.org/rfc/rfc9562#section-5.4) string, so replicas can create identities without asking a server.
