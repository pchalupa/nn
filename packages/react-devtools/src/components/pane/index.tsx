import type { ReactNode } from "react";

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
