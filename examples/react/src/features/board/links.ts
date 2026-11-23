/** What a ticket link points to. */
export type LinkKind = "pull-request" | "commit" | "document";

/** How a link is shown: its kind, a short title and a secondary meta text. */
export interface LinkDescription {
	kind: LinkKind;
	title: string;
	meta: string;
}

const pullRequestPath = /\/pull\/(\d+)(?:\/|$)/;
const commitPath = /\/commit\/([0-9a-f]{7,40})(?:\/|$)/i;
const shortHashLength = 7;

const decodeSegment = (segment: string) => {
	try {
		return decodeURIComponent(segment);
	} catch {
		return segment;
	}
};

/** Tells whether the URL is a valid http or https URL, the only kind rendered as a link. */
export function isWebUrl(url: string): boolean {
	const protocol = URL.parse(url)?.protocol;

	return protocol === "http:" || protocol === "https:";
}

/** Describes a link URL as a pull request, a commit or a document. */
export function describeLink(url: string): LinkDescription {
	const parsed = URL.parse(url);

	if (!parsed) return { kind: "document", title: url, meta: "" };

	const pullRequest = pullRequestPath.exec(parsed.pathname)?.[1];

	if (pullRequest) return { kind: "pull-request", title: `PR #${pullRequest}`, meta: `#${pullRequest}` };

	const commit = commitPath.exec(parsed.pathname)?.[1];

	if (commit) {
		const shortHash = commit.slice(0, shortHashLength).toLowerCase();

		return { kind: "commit", title: `Commit ${shortHash}`, meta: shortHash };
	}

	const fileName = parsed.pathname.split("/").findLast((segment) => segment !== "");
	let title = parsed.hostname;

	if (fileName) title = decodeSegment(fileName);

	return { kind: "document", title, meta: parsed.hostname };
}

/** Returns the trimmed input as a link URL when it is an http or https URL, otherwise undefined. */
export function parseLinkInput(input: string): string | undefined {
	const text = input.trim();

	if (isWebUrl(text)) return new URL(text).href;
}
