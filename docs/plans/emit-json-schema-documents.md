# Emit JSON Schema documents from `@nn/schema`

## Context

[ADR-01](../decisions/ADR-01-adopt-json-schema-as-the-schema-format.md) committed `@nn/schema` to JSON Schema 2020-12 as its description format. The vocabulary alignment is done: a schema's `type` is the spec's type name, annotations are `title` and `description`, and composite schemas expose `properties` and `items`. `Store.fromSchema` already reads `propertySchema.type` (`packages/store/src/Store.ts`), so the typed discriminant is in use.

What is still missing is the part the ADR was written for. The schema cannot leave the process. It is data in memory, but there is no way to write it to disk, compare it with the version that wrote an existing database, or send it to a server. This step adds that: a `toJSONSchema()` that returns a real 2020-12 document.

Validation stays out. `@nn/schema` describes structure, it does not assert it, and nothing here changes that.

## Design

### 1. New module `src/JSONSchema.ts`

This module must not import `Schema.ts`. That is what keeps `Schema.ts` free to import it without a cycle, and it is why the walk is polymorphic instead of a visitor doing `instanceof` checks. It exports:

- `JSONSchemaNode`, the types for the subset we emit: `$schema`, `$id`, `$ref`, `$defs`, `type`, `title`, `description`, `properties`, `required`, `items`.
- `DIALECT = "https://json-schema.org/draft/2020-12/schema"`.
- `class SchemaContext`, which owns the `$defs` registry, with `register(title, build)` returning `{ $ref: "#/$defs/<escaped title>" }`.

The registry is keyed on the title verbatim, but the `$ref` is a [JSON Pointer](https://datatracker.ietf.org/doc/rfc6901/), so `register` escapes the title before joining it onto `#/$defs/` — `~` becomes `~0` and `/` becomes `~1`, in that order. Without it a title such as `a/b` registers one definition but emits a pointer that resolves as two nested keys.

`register` has to reserve the key before it calls `build`. That is what stops a self-referencing schema from recursing forever, and it makes the second use of a schema return the `$ref` without building it again.

Two schemas that share a title but are not the same object are a conflict, so the registry throws instead of letting one definition quietly win. The same object seen twice is the normal case and returns the `$ref` we already have.

### 2. Polymorphic emission in `src/Schema.ts`

Each class implements `toNode(context: SchemaContext): JSONSchemaNode`:

- `Schema` (base) returns `{ type: this.type }` plus `title` and `description` when they are set. A titled schema returns `context.register(this.title, …)` instead of its body, so hoisting is handled once in the base class rather than repeated in every subclass.
- `ObjectSchema` adds `properties`, built by calling `toNode` on each child, and `required` listing every key. Every key is required because `Infer` makes all properties non-optional, and `properties` on its own says nothing about whether a property has to be there. We do not emit `additionalProperties`.
- `ArraySchema` adds `items` from `this.items.toNode(context)`, and nothing else. `ArraySchema` no longer injects `& { id: string }`, so there is no intersection to encode.

The public entry point sits on the base class:

```ts
toJSONSchema(options?: { id?: string }): JSONSchemaNode
```

It builds a `SchemaContext`, calls `this.toNode(context)`, then attaches `$schema: DIALECT`, `$id` when it was given, and `$defs` when the registry is not empty.

Two details in that method:

- The root emits inline even when it has a title. Everything else hoists, but a root that returned `{ $ref: "#/$defs/x" }` would be a document whose whole content is a pointer into itself. So `toJSONSchema` builds the root body directly instead of going through `register`.
- `$id` stays opt-in and is never derived from `title`. The spec wants a URI there, and `title` names a definition, not a document.

### 3. Exports in `src/index.ts`

Re-export the `JSONSchemaNode` type. A `./JSONSchema` subpath in `packages/schema/package.json` would match the per-module `exports` style of `packages/entities/package.json`, but the single `"."` entry works too and is what this package uses today.

## Expected output

For the schema in `apps/example-react/src/store.ts`:

```json
{
	"$schema": "https://json-schema.org/draft/2020-12/schema",
	"type": "object",
	"properties": {
		"users": {
			"type": "array",
			"description": "List of users",
			"items": { "$ref": "#/$defs/user" }
		},
		"tickets": {
			"type": "array",
			"description": "List of tickets",
			"items": { "$ref": "#/$defs/ticket" }
		}
	},
	"required": ["users", "tickets"],
	"$defs": {
		"user": {
			"type": "object",
			"title": "user",
			"description": "Holds information about a user.",
			"properties": {
				"name": { "type": "string", "description": "User name" },
				"email": { "type": "string" }
			},
			"required": ["name", "email"]
		},
		"ticket": {
			"type": "object",
			"title": "ticket",
			"description": "Holds information about a ticket.",
			"properties": {
				"title": { "type": "string" },
				"description": { "type": "string" },
				"status": { "type": "string" },
				"assignee": { "$ref": "#/$defs/user" }
			},
			"required": ["title", "description", "status", "assignee"]
		}
	}
}
```

## Not in this step

- Validation of any kind.
- Reading documents back in with a `fromJSONSchema()` parser.
- Constraint keywords such as `minLength`, `minimum` and `pattern`, and optional properties. The builder cannot express them, so there is nothing to emit. Worth knowing before we add them: the spec treats `format` as an annotation and does not require it to assert anything, so a keyword we emit without a validator running is documentation, not a rule.

## Files

| File                                     | Change                                                |
| ---------------------------------------- | ----------------------------------------------------- |
| `packages/schema/src/JSONSchema.ts`      | new: emitted-subset types, `DIALECT`, `SchemaContext` |
| `packages/schema/src/Schema.ts`          | `toNode` per class, `toJSONSchema` on the base        |
| `packages/schema/src/index.ts`           | re-export the new type                                |
| `packages/schema/src/JSONSchema.test.ts` | new: colocated vitest, matching the sibling packages  |
| `packages/schema/README.md`              | document `toJSONSchema()` and show a real document    |
| `.changeset/*.md`                        | minor bump for `@nn/schema`                           |

## Verification

Run `pnpm vitest run packages/schema`. The tests should cover:

- every primitive emits its own `type`
- `required` lists all object keys
- a titled schema hoists to `$defs`, and both uses emit the same `$ref`
- a schema used twice produces exactly one definition
- a self-referencing schema terminates
- two different schemas sharing a title throw
- the root emits inline even when it has a title
- `$schema` is always there, `$id` only when asked for, `$defs` only when something was hoisted

Assert whole documents with `toMatchInlineSnapshot`, the way `packages/store/src/Store.test.ts` does.

Then run `pnpm --filter @nn/schema ts:check` for a clean type signal. The root `pnpm ts:check` already fails on five pre-existing `Observable` errors in `@nn/store`, so it will not tell us much. Finish with `pnpm lint:check`, `pnpm format:check` and `pnpm spell:check`.

For an end-to-end check, emit the schema from `apps/example-react/src/store.ts` and compare it with the document above. It exercises nesting, a reused titled schema (`user` appears in `users` and again as `ticket.assignee`), two arrays and descriptions in one go. Paste the result into a 2020-12 validator such as <https://www.jsonschemavalidator.net/> to confirm the document itself is well formed.
