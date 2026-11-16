import type { Icon } from "@phosphor-icons/react";
import type { ReactNode } from "react";

interface PageHeaderProps {
	icon: Icon;
	title: string;
	meta?: string;
	actions?: ReactNode;
}

export const PageHeader = ({ icon: IconComponent, title, meta, actions }: PageHeaderProps) => (
	<header className="flex h-13 shrink-0 items-center gap-3 border-b border-line-subtle bg-panel px-4">
		<div className="flex items-center gap-2">
			<IconComponent className="size-4 text-fg-muted" />
			<h1 className="text-sm font-semibold text-fg">{title}</h1>
			{meta && <span className="text-xs text-fg-subtle">{meta}</span>}
		</div>
		<div className="flex-1" />
		{actions}
	</header>
);
