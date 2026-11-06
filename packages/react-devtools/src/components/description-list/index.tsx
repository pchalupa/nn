import type { ReactNode } from "react";

export interface DescriptionListProps {
	children: ReactNode;
}

export function DescriptionList({ children }: DescriptionListProps) {
	return <dl className="description-list">{children}</dl>;
}
