import type { ReactNode } from "react";

import { css } from "../styles/css";

export interface TextProps {
	children: ReactNode;
}

export function Text({ children }: TextProps) {
	return <span className="text">{children}</span>;
}

css`
	.text {
		color: var(--fg-muted);
	}
`;
