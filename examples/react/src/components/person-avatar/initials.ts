/** Returns the first letters of the first and last word of a name, in upper case. */
export function initials(name: string): string {
	const words = name.trim().split(/\s+/).filter(Boolean);
	const first = words.at(0);
	const last = words.at(-1);

	if (first === undefined || last === undefined) return "?";

	if (words.length === 1) return first.charAt(0).toUpperCase();

	return (first.charAt(0) + last.charAt(0)).toUpperCase();
}
