/** Radix accent color a label can take. */
export type LabelColor = "violet" | "blue" | "green" | "red" | "amber" | "orange" | "cyan" | "pink";

const colors: readonly LabelColor[] = ["violet", "blue", "green", "red", "amber", "orange", "cyan", "pink"];

/** Picks a stable color for a label name. */
export function colorFor(name: string): LabelColor {
	let sum = 0;

	for (const character of name) {
		sum += character.codePointAt(0) ?? 0;
	}

	return colors[sum % colors.length] ?? "violet";
}
