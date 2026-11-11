import type { ReactNode, Ref } from "react";

import { css } from "../styles/css";

export interface TreeItemProps {
	ref?: Ref<HTMLButtonElement>;
	label: ReactNode;
	level: number;
	expanded?: boolean;
	selected: boolean;
	onClick: () => void;
	children?: ReactNode;
}

export function TreeItem({ ref, label, level, expanded, selected, onClick, children }: TreeItemProps) {
	const style: Record<string, number> = { "--level": level };

	return (
		<>
			<button
				ref={ref}
				type="button"
				role="treeitem"
				className="tree-item"
				aria-level={level}
				aria-expanded={expanded}
				aria-selected={selected}
				style={style}
				onClick={onClick}
			>
				<span className="tree-item-caret" aria-hidden="true">
					{expanded === undefined ? "" : "▸"}
				</span>
				{label}
			</button>
			{expanded && <div role="group">{children}</div>}
		</>
	);
}

css`
	.tree-item {
		display: block;
		width: 100%;
		margin: 0;
		padding: 0 var(--space-3);
		padding-left: calc(var(--space-3) + (var(--level, 1) - 1) * var(--indent));
		overflow: hidden;
		border: 0;
		border-radius: var(--radius);
		color: inherit;
		background: transparent;
		font: inherit;
		text-align: left;
		text-overflow: ellipsis;
		white-space: nowrap;
		cursor: pointer;
	}
	.tree-item:not([aria-expanded]) {
		cursor: default;
	}
	.tree-item:hover {
		background: var(--hover);
	}
	.tree-item[aria-selected="true"] {
		background: var(--selected);
	}
	.tree-item:focus-visible {
		outline: 1px solid var(--focus);
		outline-offset: -1px;
	}
	.tree-item-caret {
		display: inline-block;
		width: 1.5ch;
		color: var(--fg-muted);
		text-align: center;
		transition: transform 0.1s ease-out;
	}
	.tree-item[aria-expanded="true"] > .tree-item-caret {
		transform: rotate(90deg);
	}
`;
