/** Appends the label to `labels` in place unless it is already present. */
export function addLabel(labels: string[], label: string): void {
	if (!labels.includes(label)) labels.push(label);
}

/** Returns the labels without any copy of `label`. */
export function withoutLabel(labels: readonly string[], label: string): string[] {
	return labels.filter((entry) => entry !== label);
}
