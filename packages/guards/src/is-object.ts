/** Any non-null object, including arrays. Functions don't pass. */
export function isObject(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}
