import type { ReactNode } from "react";

import { css } from "../styles/css";

export interface DescriptionItemProps {
	label: string;
	variant?: "raw" | "muted";
	children: ReactNode;
}

export function DescriptionItem({ label, variant, children }: DescriptionItemProps) {
	return (
		<>
			<dt>{label}</dt>
			<dd data-variant={variant}>{children}</dd>
		</>
	);
}

css`
	.description-list > dt {
		color: var(--fg-muted);
	}
	.description-list > dd {
		margin: 0;
		min-width: 0;
	}
	.description-list > dd[data-variant="raw"] {
		overflow-wrap: anywhere;
		user-select: all;
	}
	.description-list > dd[data-variant="muted"] {
		color: var(--fg-muted);
	}
`;
