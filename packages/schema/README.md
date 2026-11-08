# @nn/schema

Typed schema builders that describe the shape of store state.

## Installation

```sh
npm install @nn/schema
```

## Usage

```ts
import {
	array,
	boolean,
	enumeration,
	type InferStateType,
	number,
	object,
	string,
} from "@nn/schema";

const todo = object({
	id: string(),
	title: string().describe("What needs to be done."),
	priority: number(),
	done: boolean(),
	status: enumeration("todo", "in-progress", "done"),
}).entitle("todo");

export const schema = object({ todos: array(todo) });

export type Todo = InferStateType<typeof todo>;
```
