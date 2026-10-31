export type Unsubscribe = () => void;

export interface Observable<Delegate> {
	delegate?: Delegate;
}
