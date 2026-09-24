# JSON Schema fundamentals

Researched 2026-09-21. Covers **JSON Schema draft 2020-12** (the current version), with notes where behaviour differs from 2019-09 and draft-07.

All claims below come from the official sources at json-schema.org; each section carries its source URL.

---

## 1. What it is and how drafts work

JSON Schema is a declarative vocabulary — itself written in JSON — for describing and validating the shape of JSON documents. Two roles matter throughout:

> the _instance_ is the JSON document that is being validated or described, and the _schema_ is the document that contains the description.

A validator takes a schema plus an instance and reports whether the instance conforms.

**Drafts.** JSON Schema is versioned as dated drafts. **2020-12 is the current version**; the previous one is 2019-09, preceded by draft-07, draft-06 and draft-04. A schema declares which dialect it uses with `$schema`, whose value MUST be a string and a valid URI-reference resolving to an absolute URI. That URI names a _meta-schema_, which in turn declares the _vocabularies_ in force.

```json
{ "$schema": "https://json-schema.org/draft/2020-12/schema" }
```

Vocabularies are "sets of keywords, their syntax, and their semantics". The Core vocabulary (all the `$`-prefixed keywords) is mandatory; a meta-schema lists further vocabularies with `$vocabulary`, marking each required or optional. This is the mechanism by which, for example, `format` can be an annotation in one dialect and an assertion in another (§6).

The spec also sorts keywords into five behaviour classes, which is the mental model that makes the rest coherent:

| Class              | Examples                               | Effect                                     |
| ------------------ | -------------------------------------- | ------------------------------------------ |
| Assertions         | `type`, `minimum`, `required`          | produce a boolean validation result        |
| Applicators        | `properties`, `items`, `allOf`, `$ref` | apply subschemas and combine their results |
| Annotations        | `title`, `default`, `deprecated`       | attach information for applications        |
| Identifiers        | `$id`, `$anchor`                       | control URI resolution                     |
| Reserved locations | `$defs`, `$comment`                    | hold data without direct effect            |

**Boolean schemas.** `true` and `false` are valid schemas anywhere a schema object is allowed: `true` always passes (as if `{}`), `false` always fails (as if `{"not": {}}`).

Sources: <https://json-schema.org/learn/getting-started-step-by-step>, <https://json-schema.org/specification>, <https://json-schema.org/draft/2020-12/json-schema-core>

---

## 2. Getting started: the product catalog, keyword by keyword

The official walkthrough builds a schema for this instance:

```json
{
	"productId": 1,
	"productName": "A green door",
	"price": 12.5,
	"tags": ["home", "green"]
}
```

### Step 1 — identity and the first constraint

`$schema` fixes the dialect. `$id` is a unique URI identifying this schema. `title` and `description` are documentation only, they constrain nothing. `type` is the first real constraint.

```json
{
	"$schema": "https://json-schema.org/draft/2020-12/schema",
	"$id": "https://example.com/product.schema.json",
	"title": "Product",
	"description": "A product from Acme's catalog",
	"type": "object"
}
```

### Step 2 — `properties`

Each key under `properties` names a field of the instance and maps it to a subschema.

```json
{
	"type": "object",
	"properties": {
		"productId": {
			"description": "The unique identifier for a product",
			"type": "integer"
		},
		"productName": {
			"description": "Name of the product",
			"type": "string"
		}
	}
}
```

### Step 3 — `required` and a numeric bound

`required` lists the property names that must be present. `price` uses `exclusiveMinimum: 0` so every price is strictly greater than zero.

```json
{
	"properties": {
		"price": {
			"description": "The price of the product",
			"type": "number",
			"exclusiveMinimum": 0
		}
	},
	"required": ["productId", "productName", "price"]
}
```

### Step 4 — an optional array

`tags` stays optional (it is not in `required`). `items` constrains every element, `minItems` demands at least one entry, `uniqueItems` forbids duplicates.

```json
{
	"tags": {
		"description": "Tags for the product",
		"type": "array",
		"items": { "type": "string" },
		"minItems": 1,
		"uniqueItems": true
	}
}
```

### Step 5 — a nested object

Nesting is just a subschema with its own `type`, `properties` and `required`.

```json
{
	"dimensions": {
		"type": "object",
		"properties": {
			"length": { "type": "number" },
			"width": { "type": "number" },
			"height": { "type": "number" }
		},
		"required": ["length", "width", "height"]
	}
}
```

### Step 6 — referencing an external schema

```json
{
	"warehouseLocation": {
		"description": "Coordinates of the warehouse where the product is located.",
		"$ref": "https://example.com/geographical-location.schema.json"
	}
}
```

### The finished schema

```json
{
	"$schema": "https://json-schema.org/draft/2020-12/schema",
	"$id": "https://example.com/product.schema.json",
	"title": "Product",
	"description": "A product from Acme's catalog",
	"type": "object",
	"properties": {
		"productId": {
			"description": "The unique identifier for a product",
			"type": "integer"
		},
		"productName": {
			"description": "Name of the product",
			"type": "string"
		},
		"price": {
			"description": "The price of the product",
			"type": "number",
			"exclusiveMinimum": 0
		},
		"tags": {
			"description": "Tags for the product",
			"type": "array",
			"items": { "type": "string" },
			"minItems": 1,
			"uniqueItems": true
		},
		"dimensions": {
			"type": "object",
			"properties": {
				"length": { "type": "number" },
				"width": { "type": "number" },
				"height": { "type": "number" }
			},
			"required": ["length", "width", "height"]
		},
		"warehouseLocation": {
			"description": "Coordinates of the warehouse where the product is located.",
			"$ref": "https://example.com/geographical-location.schema.json"
		}
	},
	"required": ["productId", "productName", "price"]
}
```

Source: <https://json-schema.org/learn/getting-started-step-by-step>

---

## 3. Core vocabulary reference

### Types

Seven primitive types: `string`, `number`, `integer`, `object`, `array`, `boolean`, `null`.

`type` takes either a single string or an array of strings, in which case any listed type is acceptable.

```json
{ "type": "number" }              // 42 ✓  42.0 ✓  "42" ✗
{ "type": ["number", "string"] }  // 42 ✓  "everything" ✓  [] ✗
```

Note `integer` matches integral values regardless of notation — JSON `1` and `1.0` are both integers.

Source: <https://json-schema.org/understanding-json-schema/reference/type>, <https://json-schema.org/understanding-json-schema/reference/numeric>

### Object keywords

| Keyword                           | Meaning                                                                                                           |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `properties`                      | map of property name → subschema                                                                                  |
| `patternProperties`               | map of regex → subschema, applied to matching property names                                                      |
| `additionalProperties`            | schema (or `false`) for properties matched by neither of the above                                                |
| `unevaluatedProperties`           | like `additionalProperties`, but also counts properties evaluated by subschemas (`allOf`, `$ref`, `if`/`then`, …) |
| `required`                        | array of property names that must be present                                                                      |
| `propertyNames`                   | schema applied to each property _name_ (always a string)                                                          |
| `minProperties` / `maxProperties` | bounds on the property count                                                                                      |

```json
{
	"type": "object",
	"properties": { "id": { "type": "number" } },
	"patternProperties": {
		"^S_": { "type": "string" },
		"^I_": { "type": "integer" }
	},
	"additionalProperties": false,
	"required": ["id"],
	"propertyNames": { "pattern": "^[A-Za-z_][A-Za-z0-9_]*$" },
	"minProperties": 1,
	"maxProperties": 10
}
```

`unevaluatedProperties` is what makes composition closable:

```json
{
	"allOf": [{ "properties": { "street": { "type": "string" } } }],
	"properties": { "city": { "type": "string" } },
	"unevaluatedProperties": false
}
```

Source: <https://json-schema.org/understanding-json-schema/reference/object>

### Array keywords

| Keyword                       | Meaning                                                                          |
| ----------------------------- | -------------------------------------------------------------------------------- |
| `items`                       | schema applied to every element _not_ covered by `prefixItems` (list validation) |
| `prefixItems`                 | array of schemas validating positions 0, 1, 2 … (tuple validation)               |
| `unevaluatedItems`            | items not covered by `items`, `prefixItems` or `contains`                        |
| `contains`                    | at least one element must match this schema                                      |
| `minContains` / `maxContains` | how many elements must match `contains` (2019-09+)                               |
| `minItems` / `maxItems`       | length bounds                                                                    |
| `uniqueItems`                 | `true` requires all elements distinct                                            |

```json
{ "type": "array", "items": { "type": "number" }, "minItems": 2, "uniqueItems": true }
```

```json
{
	"type": "array",
	"prefixItems": [{ "type": "number" }, { "type": "string" }],
	"items": false
}
```

The last line is the 2020-12 way to say "a tuple of exactly these two, nothing more" — `items` after `prefixItems` governs the tail.

Source: <https://json-schema.org/understanding-json-schema/reference/array>

### String keywords

```json
{ "type": "string", "minLength": 2, "maxLength": 3 }
{ "type": "string", "pattern": "^(\\([0-9]{3}\\))?[0-9]{3}-[0-9]{4}$" }
{ "type": "string", "format": "date-time" }
```

`pattern` uses ECMA-262 regular expression syntax, and in 2020-12 implementations are expected (though not strictly required) to support Unicode. A pattern matches _anywhere_ in the string unless anchored with `^` … `$`.

`format` is annotation-only by default — see §6.

Source: <https://json-schema.org/understanding-json-schema/reference/string>

### Numeric keywords

```json
{ "type": "number",  "multipleOf": 10 }
{ "type": "number",  "minimum": 0, "maximum": 100 }
{ "type": "number",  "minimum": 0, "exclusiveMaximum": 100 }
{ "type": "integer" }
```

`minimum`/`maximum` are inclusive; `exclusiveMinimum`/`exclusiveMaximum` are strict (`x > exclusiveMinimum`, `x < exclusiveMaximum`) and take **numbers**, not booleans. Draft-04 used booleans here and was changed "to have better keyword independence" — a real hazard when porting old schemas.

Source: <https://json-schema.org/understanding-json-schema/reference/numeric>

---

## 4. Composition, conditionals and references

### Boolean combinators

```json
{ "allOf": [{ "type": "string" }, { "maxLength": 5 }] }
```

```json
{
	"anyOf": [
		{ "type": "string", "maxLength": 5 },
		{ "type": "number", "minimum": 0 }
	]
}
```

```json
{
	"oneOf": [
		{ "type": "number", "multipleOf": 5 },
		{ "type": "number", "multipleOf": 3 }
	]
}
```

```json
{ "not": { "type": "string" } }
```

- `allOf` = AND, `anyOf` = one or more, `oneOf` = exactly one, `not` = negation.
- With that `oneOf`, `10` and `9` validate but `15` fails — it matches both branches.
- The docs advise preferring `anyOf` where possible: `oneOf` must evaluate every branch to prove exclusivity, "which can lead to increased processing times".
- `allOf` is **not** inheritance. You cannot "extend" a schema with it — the instance must independently satisfy every branch, which is precisely why `allOf` + `additionalProperties: false` fails (see §6).

Source: <https://json-schema.org/understanding-json-schema/reference/combining>

### if / then / else

If the `if` subschema validates, `then` applies; otherwise `else` does.

```json
{
	"type": "object",
	"properties": {
		"street_address": { "type": "string" },
		"country": {
			"default": "United States of America",
			"enum": ["United States of America", "Canada"]
		}
	},
	"if": {
		"properties": { "country": { "const": "United States of America" } }
	},
	"then": {
		"properties": { "postal_code": { "pattern": "[0-9]{5}(-[0-9]{4})?" } }
	},
	"else": {
		"properties": { "postal_code": { "pattern": "[A-Z][0-9][A-Z] [0-9][A-Z][0-9]" } }
	}
}
```

For more than two branches, wrap `if`/`then` pairs inside `allOf`, each `if` also `required`-ing the discriminating property. Before draft-07 the same thing was written as `anyOf` of `not` — the implication `!A || B`.

Related: `dependentRequired` (if property X is present, these other properties are required) and `dependentSchemas` (if property X is present, apply this whole subschema).

Source: <https://json-schema.org/understanding-json-schema/reference/conditionals>

### `$id`, `$ref`, `$defs`, `$anchor`

`$id` sets the schema resource's base URI; relative references resolve against it. Absolute URIs are the portable choice. Per the core spec, `$id` must resolve to an absolute-URI without a fragment (or with an empty one), and MUST NOT carry a non-empty fragment.

```json
{
	"$id": "https://example.com/schemas/address",
	"type": "object",
	"properties": {
		"street_address": { "type": "string" },
		"city": { "type": "string" }
	}
}
```

```json
{
	"$id": "https://example.com/schemas/customer",
	"properties": {
		"shipping_address": { "$ref": "/schemas/address" },
		"billing_address": { "$ref": "/schemas/address" }
	}
}
```

`$defs` is the standard place for reusable local subschemas, addressed by JSON Pointer fragment:

```json
{
	"type": "object",
	"properties": {
		"first_name": { "$ref": "#/$defs/name" },
		"last_name": { "$ref": "#/$defs/name" }
	},
	"$defs": {
		"name": { "type": "string" }
	}
}
```

`$anchor` gives a subschema a plain-name fragment so you can reference it without a pointer path (`#street_address`). Anchor names must start with a letter, followed by letters, digits, hyphens, underscores, colons or periods.

Recursion is `{"$ref": "#"}` — a schema referring to its own root, which is how tree structures are described.

**Bundling.** Several schema resources can be embedded in one document by giving subschemas their own `$id`, producing a _Compound Schema Document_; each embedded resource evaluates independently and may even declare a different `$schema`. The usual place to put them is `$defs`.

**`$dynamicRef` / `$dynamicAnchor`.** These are the 2020-12 replacement for 2019-09's `$recursiveRef`/`$recursiveAnchor`. Unlike `$ref`, which resolves statically at the point of definition, a `$dynamicRef` resolves at evaluation time against the outermost `$dynamicAnchor` of the same name in the dynamic scope. The use case is cooperative extension of recursive schemas: a generic "tree" schema can defer part of its definition so that a schema extending it has its own constraints applied at every level of the recursion. In 2020-12 the fragments are no longer required to be empty and non-fragment-only URIs are allowed.

Sources: <https://json-schema.org/understanding-json-schema/structuring>, <https://json-schema.org/draft/2020-12/json-schema-core>, <https://json-schema.org/draft/2020-12/release-notes>

---

## 5. Annotations and metadata

None of these affect validation; they exist to describe the schema for humans and tooling.

```json
{
	"title": "Match anything",
	"description": "This is a schema that matches anything.",
	"default": "Default value",
	"examples": ["Anything", 4035],
	"deprecated": true,
	"readOnly": true,
	"writeOnly": false
}
```

- `title` / `description` — both strings; title short, description explanatory. Intended for UI decoration.
- `default` — a default value. The spec: "It is RECOMMENDED that a default value be valid against the associated schema." A validator will not fill it in for you.
- `examples` — array of sample values; likewise RECOMMENDED to be valid.
- `deprecated` — when `true`, applications "SHOULD refrain from usage of the declared property".
- `readOnly` / `writeOnly` — the value is managed by an authority and not to be modified (e.g. a database-generated serial), or never present on retrieval (e.g. a password).

Sources: <https://json-schema.org/understanding-json-schema/reference/annotations>, <https://json-schema.org/draft/2020-12/json-schema-validation>

---

## 6. Gotchas worth knowing before you write schemas

**`additionalProperties` does not see into subschemas.** It only considers properties matched by `properties` and `patternProperties` _in the same schema object_. Combine schemas with `allOf` or `$ref` and then set `additionalProperties: false`, and everything the referenced branch declared will be rejected. `unevaluatedProperties` is the fix: it takes annotations from subschemas into account, so it knows which properties were already evaluated. Same relationship holds for `additionalItems`-style tail control versus `unevaluatedItems`. These keywords depend on annotation collection, which is why they live in their own vocabulary in 2020-12.
Sources: <https://json-schema.org/understanding-json-schema/reference/object>, <https://json-schema.org/draft/2020-12/json-schema-core>, <https://json-schema.org/draft/2020-12/release-notes>

**`format` does not validate by default.** The value of `format` MUST be collected as an annotation. The Format-Annotation vocabulary is the required default, and implementations that also assert formats must have that behaviour disabled by default. The separate Format-Assertion vocabulary, when declared with value `true`, requires full validation support for every format in the spec — and an implementation that cannot provide it "MUST refuse to process the schema". Practically: if you need `email` or `date-time` enforced, turn it on explicitly in your validator (§7).
Defined formats: `date-time`, `date`, `time`, `duration`; `email`, `idn-email`; `hostname`, `idn-hostname`; `ipv4`, `ipv6`; `uuid`, `uri`, `uri-reference`, `iri`, `iri-reference`; `uri-template`; `json-pointer`, `relative-json-pointer`; `regex`.
Source: <https://json-schema.org/draft/2020-12/json-schema-validation>

**`items` changed meaning in 2020-12.** In draft-07/2019-09, `items` with an _array_ value did tuple validation and `additionalItems` governed the tail. In 2020-12 both were replaced: `prefixItems` does tuple validation and `items` (always a single schema) governs everything after the prefix. An old schema with `"items": [ … ]` is not valid 2020-12 tuple validation.
Sources: <https://json-schema.org/understanding-json-schema/reference/array>, <https://json-schema.org/draft/2020-12/release-notes>

**`required` does not define a property.** It only asserts presence. Listing a name in `required` without a matching entry in `properties` means "this key must exist, with any value whatsoever". Conversely, a property described in `properties` is entirely optional unless it also appears in `required` — which is what makes `tags` optional in the product example.
Source: <https://json-schema.org/learn/getting-started-step-by-step>, <https://json-schema.org/understanding-json-schema/reference/object>

**`oneOf` is exclusive.** An instance valid against two branches fails. Use `anyOf` unless exclusivity is the point; the docs also flag `oneOf` as the slower option.
Source: <https://json-schema.org/understanding-json-schema/reference/combining>

**`allOf` is not inheritance.** There is no override semantics; every branch applies to the same instance simultaneously, so it is easy to write a schema nothing can satisfy (`{"allOf": [{"type": "string"}, {"type": "number"}]}`).
Source: <https://json-schema.org/understanding-json-schema/reference/combining>

**Chained `$ref` loops are prohibited.** Self-recursion via `$ref: "#"` is fine; `$ref`s that resolve into each other in a cycle with no instance consumed are not.
Source: <https://json-schema.org/understanding-json-schema/structuring>

**`exclusiveMinimum`/`exclusiveMaximum` are numbers, not booleans** (draft-06 onward). See §3.

---

## 7. Ecosystem

The json-schema.org tooling index lists these MIT-licensed JavaScript/TypeScript validators with draft 2020-12 support: **ajv**, **@cfworker/json-schema**, **@exodus/schemasafe**, **@hyperjump/json-schema**, **@imhonglu/json-schema**. Implementations exist for most other languages too; the index is filterable by draft, language and tooling type.
Source: <https://json-schema.org/tools>

**Ajv** specifics, since it is the common default in JS projects:

- Supports draft-04, draft-06, draft-07 (the default), 2019-09 and 2020-12.
- 2020-12 requires a different entry point — "To use draft-2020-12 schemas you need to import a different Ajv class", and draft-2020-12 "is not backwards compatible".
- Formats are not bundled: "Ajv does not include any formats, they can be added with the ajv-formats plugin." This is consistent with `format` being annotation-only by default in the spec.

Source: <https://ajv.js.org/json-schema.html>

---

## Source list

- Getting started walkthrough — <https://json-schema.org/learn/getting-started-step-by-step>
- Understanding JSON Schema (type, object, array, string, numeric, combining, conditionals, annotations, structuring) — <https://json-schema.org/understanding-json-schema>
- Core spec, draft 2020-12 — <https://json-schema.org/draft/2020-12/json-schema-core>
- Validation spec, draft 2020-12 — <https://json-schema.org/draft/2020-12/json-schema-validation>
- Specification / version history — <https://json-schema.org/specification>
- 2020-12 release notes — <https://json-schema.org/draft/2020-12/release-notes>
- Tooling index — <https://json-schema.org/tools>
- Ajv JSON Schema support — <https://ajv.js.org/json-schema.html>
