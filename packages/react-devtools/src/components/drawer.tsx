import type { ReactNode } from "react";

import { css } from "../styles/css";
import { Button } from "./button";

export interface DrawerProps {
	title: string;
	label: string;
	children: ReactNode;
	onClose: () => void;
}

export function Drawer({ title, label, children, onClose }: DrawerProps) {
	return (
		<aside className="drawer" aria-label={label}>
			<header className="drawer-bar">
				<span className="label">{title}</span>
				<Button text="Close" onClick={onClose} />
			</header>
			{children}
		</aside>
	);
}

css`
	.drawer {
		position: fixed;
		right: 0;
		bottom: 0;
		left: 0;
		z-index: var(--z);
		display: flex;
		flex-direction: column;
		height: 40vh;
		border-top: var(--gs-border-width) solid var(--gs-panel-border);
		color: var(--gs-panel-text);
		background: var(--gs-panel-bg);
	}
	.drawer-bar {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: var(--gs-space-3);
		padding: var(--gs-space-2) var(--gs-space-4);
		border-bottom: var(--gs-border-width) solid var(--gs-panel-border);
	}
	.label {
		color: var(--gs-panel-label);
		line-height: var(--gs-leading-label);
		letter-spacing: var(--gs-tracking-label);
		text-transform: uppercase;
	}
`;
