import { Plus } from "@phosphor-icons/react";
import type { ReactNode } from "react";

interface TagProps {
	children: ReactNode;
	onClick: () => void;
}

export const Tag = ({ children, onClick }: TagProps) => (
	<button
		type="button"
		className="inline-flex h-5 items-center gap-1 rounded-sm border border-line px-1.5 text-xs text-fg-muted hover:bg-selected"
		onClick={onClick}
	>
		<Plus className="size-3" />
		{children}
	</button>
);
