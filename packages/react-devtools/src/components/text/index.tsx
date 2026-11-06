import type { ReactNode } from "react";

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
