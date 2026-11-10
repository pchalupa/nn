import type { ReactNode } from "react";

import { css } from "../styles/css";

export interface TextProps {
	as?: "span" | "p";
	tone?: "muted" | "accent";
	children: ReactNode;
}

export function Text({ as: Element = "span", tone, children }: TextProps) {
	return (
		<Element className="text" data-tone={tone}>
			{children}
		</Element>
	);
}

css`
	p.text {
		margin: 0 0 var(--space-3);
	}
	.text[data-tone="muted"] {
		color: var(--fg-muted);
	}
	.text[data-tone="accent"] {
		color: var(--accent);
	}
`;
