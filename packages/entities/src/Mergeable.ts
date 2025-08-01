export interface Mergeable {
	merge(remote: Mergeable): Mergeable;
}
