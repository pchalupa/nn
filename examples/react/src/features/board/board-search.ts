/** Board filters carried in the URL search. */
export interface BoardSearch {
	assignee?: "me";
	label?: string;
}

/** Keeps only the known board filters from a raw URL search. */
export function validateBoardSearch(search: Record<string, unknown>): BoardSearch {
	const result: BoardSearch = {};

	if (search.assignee === "me") result.assignee = "me";

	if (typeof search.label === "string" && search.label !== "") result.label = search.label;

	return result;
}

/** Tells whether a ticket passes the board filters for the given user. */
export function matchesBoardSearch(
	ticket: { assignee: string; labels: readonly string[] },
	search: BoardSearch,
	userId: string | undefined,
): boolean {
	if (search.assignee === "me" && (userId === undefined || ticket.assignee !== userId)) return false;

	if (search.label !== undefined && !ticket.labels.includes(search.label)) return false;

	return true;
}

/** Returns the fields a new ticket needs to pass the board filters for the given user. */
export function draftForBoardSearch(
	search: BoardSearch,
	userId: string | undefined,
): { assignee?: string; labels?: string[] } {
	const draft: { assignee?: string; labels?: string[] } = {};

	if (search.assignee === "me" && userId !== undefined) draft.assignee = userId;

	if (search.label !== undefined) draft.labels = [search.label];

	return draft;
}

/** Returns the board filters without the given one. */
export function withoutFilter(search: BoardSearch, filter: keyof BoardSearch): BoardSearch {
	const result: BoardSearch = {};

	if (filter !== "assignee" && search.assignee !== undefined) result.assignee = search.assignee;

	if (filter !== "label" && search.label !== undefined) result.label = search.label;

	return result;
}
