import type { ReactNode } from "react";

export interface TreeProps {
	label: string;
	children: ReactNode;
}

export function Tree({ label, children }: TreeProps) {
	return (
		<div role="tree" aria-label={label}>
			{children}
		</div>
	);
}
