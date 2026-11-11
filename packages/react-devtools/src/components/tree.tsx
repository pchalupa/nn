import type { ReactNode } from "react";

import { css } from "../styles/css";

export interface TreeProps {
	label: string;
	children: ReactNode;
}

export function Tree({ label, children }: TreeProps) {
	return (
		<div role="tree" aria-label={label} className="tree">
			{children}
		</div>
	);
}

css`
	.tree {
		flex: 1;
		min-height: 0;
		padding: var(--space-3);
		overflow: auto;
		scrollbar-width: thin;
		scrollbar-color: var(--border) transparent;
	}
`;
