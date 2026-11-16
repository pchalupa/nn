import type { ReactNode } from "react";

export const Property = ({ name, children }: { name: string; children: ReactNode }) => (
	<div className="flex h-8 items-center gap-3">
		<span className="w-24 shrink-0 text-sm text-fg-subtle">{name}</span>
		{children}
	</div>
);
