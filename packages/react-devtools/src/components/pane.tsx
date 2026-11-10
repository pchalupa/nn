import type { ReactNode } from "react";

import { css } from "../styles/css";

export interface PaneProps {
	label: string;
	children: ReactNode;
}

export function Pane({ label, children }: PaneProps) {
	return (
		<section className="pane" aria-label={label}>
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
