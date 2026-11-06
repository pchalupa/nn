import type { ReactNode } from "react";

import { Button } from "../button";

export interface DrawerProps {
	title: string;
	label: string;
	onClose: () => void;
	children: ReactNode;
}

export function Drawer({ title, label, onClose, children }: DrawerProps) {
	return (
		<aside className="drawer" aria-label={label}>
			<header className="drawer-bar">
				<span>{title}</span>
				<Button text="Close" onClick={onClose} />
			</header>
			{children}
		</aside>
	);
}
