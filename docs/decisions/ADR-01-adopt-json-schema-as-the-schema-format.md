---
author: Petr Chalupa
date: 2026-09-21
---

# ADR-01: Adopt JSON Schema as the schema format

## Context

`@nn/schema` declares the shape of a store. Today it is a fluent builder (`string()`, `object()`, `array()`) that produces `Schema` objects, and the shape it describes lives only in TypeScript's type system through the `Infer` helper. TypeScript types are erased when the code compiles, so at runtime there is nothing to read.

This library is local-first. Data sits in IndexedDB on the device, syncs between a user's devices, and has to survive the app being updated while old data is still on disk. Persistence, sync and schema migration all need to answer the same question at runtime: what shape is this data? A schema that only exists at compile time cannot answer it. To store a schema next to the data, compare it against the version that wrote that data, or send it to a server, the schema has to be data itself.

The schema format is a big part of this library's public surface. Everything stored on disk and everything sent over the wire is described by it, so changing the format later means migrating stored schemas and breaking every consumer.

## Decision

We will use [JSON Schema 2020-12](https://json-schema.org/draft/2020-12/schema) as the format `@nn/schema` describes data in. We pick an industry standard rather than inventing one, so the schemas we write are readable by tools we did not build.

`packages/schema/src/Schema.ts` speaks the spec's vocabulary: a schema's `type` is the JSON Schema type name (`"string"`, `"number"`, `"boolean"`, `"object"`, `"array"`), each type has its own class so a schema carries its type as data, and the annotations are the spec's `title` and `description`, set by `entitle()` and `describe()`. Composite schemas expose `properties` and `items`, which are spec keywords too.

We will not validate data. `@nn/schema` describes structure, it does not assert it.

## Alternatives considered

**Keep our own format.** We could leave the builder's naming as it is and design a serialization format when persistence needs one. We rejected this because the format is central here, and a homegrown one gets no tooling. Every reader would have to be written by us, and we would have to solve references, composition and versioning ourselves. JSON Schema has already solved them, and the answers have been reviewed by more people than this project will ever have.

**Depend on Zod or Valibot instead of our own builder.** Both are mature, and [Zod converts in both directions](https://zod.dev/json-schema) with `z.toJSONSchema()` and `z.fromJSONSchema()`, though the second is marked experimental as of 2026-09-21. We rejected this because the builder and its type inference are part of what this library is, and a dependency would move that core outside it. The interop argument also runs the other way: because Zod reads JSON Schema, emitting the standard gives us Zod compatibility for free, without taking the dependency.

## Consequences

The schema is expressible as data. A schema carries its type and its annotations at runtime, which is what it needs before it can be written to disk beside the data it describes, compared against the version that wrote an existing database, or sent to a server. Those are the problems the thesis treats as core to local-first apps, and this is the format we will solve them in.

We get interop we did not write. Anything that reads JSON Schema can read our schemas, including Zod and any standard validator.

We accept being tied to the 2020-12 dialect. Moving to a future dialect means migrating stored schemas, which is the same cost we were trying to avoid with a homegrown format, just deferred and shared with the rest of the ecosystem.

We also accept a gap between what the spec allows and what our builder can say. A schema covers a small part of the vocabulary: there are no conditionals, no `patternProperties`, and no string or numeric constraints. A reader who knows JSON Schema may expect more than a schema can describe.
