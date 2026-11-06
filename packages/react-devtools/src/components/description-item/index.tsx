import type { ReactNode } from "react";

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
