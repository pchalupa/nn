import { FileTextIcon, GitCommitIcon, GitPullRequestIcon } from "@phosphor-icons/react";

import type { LinkKind } from "@/features/board/links";

const iconSize = 14;

interface LinkKindIconProps {
	kind: LinkKind;
}

/** Renders the icon of a link kind. */
export const LinkKindIcon = ({ kind }: LinkKindIconProps) => {
	if (kind === "pull-request") return <GitPullRequestIcon size={iconSize} color="var(--green-11)" />;

	if (kind === "commit") return <GitCommitIcon size={iconSize} color="var(--gray-a11)" />;

	return <FileTextIcon size={iconSize} color="var(--gray-a11)" />;
};
