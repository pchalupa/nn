export type Unsubscribe = () => void;

export type Callback = () => void;

export interface Observable {
	subscribe: (callback: Callback) => Unsubscribe;
}
