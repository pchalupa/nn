import type { ReactNode } from "react";

import { css } from "../../css";

export interface PaneProps {
	label: string;
	role?: "tree";
	children: ReactNode;
}

export function Pane({ label, role, children }: PaneProps) {
	return (
		<section className="pane" role={role} aria-label={label}>
			{children}
		</section>
	);
}

css`
	.pane {
		flex: 1;
		min-width: 0;
		padding: var(--space-3);
		overflow: auto;
		scrollbar-width: thin;
		scrollbar-color: var(--border) transparent;
	}
`;
