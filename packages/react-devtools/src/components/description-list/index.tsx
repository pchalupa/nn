import type { ReactNode } from "react";

import { css } from "../../css";

export interface DescriptionListProps {
	children: ReactNode;
}

export function DescriptionList({ children }: DescriptionListProps) {
	return <dl className="description-list">{children}</dl>;
}

css`
	.description-list {
		display: grid;
		grid-template-columns: max-content 1fr;
		gap: var(--space-1) var(--space-4);
		margin: 0 0 var(--space-3);
	}
`;
