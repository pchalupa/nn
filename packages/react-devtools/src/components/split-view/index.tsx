import type { ReactNode } from "react";

export interface SplitViewProps {
	children: ReactNode;
}

export function SplitView({ children }: SplitViewProps) {
	return <div className="split-view">{children}</div>;
}
