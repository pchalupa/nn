/** Returns a short display key for a ticket id. */
export function ticketKey(id: string): string {
	return `#${id.slice(0, 4)}`;
}
