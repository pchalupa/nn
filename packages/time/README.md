# @nn/time

Hybrid logical clock.

## Installation

```sh
npm install @nn/time
```

## Usage

A [hybrid logical clock](https://cse.buffalo.edu/tech-reports/2014-04.pdf) combines the wall clock time with a counter and a replica identity. Times keep a consistent order across replicas even when events happen in the same millisecond.

```ts
import { Time } from "@nn/time";

const first = Time.now();
const second = Time.now();

second.isAfter(first);
first.compare(second);
```

### Storing and restoring times

```ts
const timestamp = first.toString();

const restored = Time.fromTimestamp(timestamp);
```
