export type Unsubscribe = () => void;

export type Callback = () => void;

export interface Observable {
	onChange: (callback: Callback) => Unsubscribe;
}
