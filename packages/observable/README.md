# @nn/observable

Observer and delegate primitives for change notification.

## Installation

```sh
npm install @nn/observable
```

## Usage

`Observable` notifies every subscribed observer. `subscribe` returns a function that unsubscribes.

```ts
import { Observable } from "@nn/observable/observable";

const changes = new Observable<[string]>();

const unsubscribe = changes.subscribe((value) => console.log(value));

changes.notify("changed");
unsubscribe();
```

### Delegates

`Delegatable` types an object that reports to a single delegate.

```ts
import type { Delegatable } from "@nn/observable";

interface TimerDelegate {
	timerDidFire(timer: Timer): void;
}

class Timer implements Delegatable<TimerDelegate> {
	public delegate?: TimerDelegate;

	public fire(): void {
		this.delegate?.timerDidFire(this);
	}
}
```
