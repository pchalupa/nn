import { isObject } from "@goodstate/guards/is-object";
import type { ReactNode } from "react";

import { css } from "../styles/css";
import { TreeBranch } from "./tree-branch";
import { TreeLeaf } from "./tree-leaf";

export interface TreeNodeProps {
	label: string;
	value: unknown;
	level: number;
}

export function TreeNode({ label, value, level }: TreeNodeProps): ReactNode {
	if (isObject(value)) {
		return (
			<TreeBranch label={label} value={value} level={level}>
				{() =>
					Object.entries(value).map(([segment, field]) => (
						<TreeNode key={segment} label={segment} value={field} level={level + 1} />
					))
				}
			</TreeBranch>
		);
	}

	return <TreeLeaf label={label} value={value} level={level} />;
}

css`
	.tree-node {
		display: block;
		width: 100%;
		margin: 0;
		padding: 0 var(--gs-space-4);
		padding-left: calc(var(--gs-space-4) + (var(--level, 1) - 1) * var(--indent));
		overflow: hidden;
		border: 0;
		border-radius: 0;
		color: var(--gs-syntax-default);
		background: transparent;
		font: inherit;
		font-variant-numeric: tabular-nums;
		text-align: left;
		text-overflow: ellipsis;
		white-space: nowrap;
		cursor: pointer;
		transition: background-color var(--gs-duration) var(--gs-ease);
	}
	.tree-node[aria-level="1"]:not(:first-child) {
		border-top: var(--gs-border-width) solid var(--gs-panel-border);
	}
	.tree-node:hover {
		background: var(--gs-panel-bg-raised);
	}
	.tree-node[aria-expanded="true"] {
		box-shadow: inset 2px 0 0 var(--gs-panel-accent);
	}
	.tree-node:focus-visible {
		outline: var(--gs-focus-width) solid var(--gs-panel-focus);
		outline-offset: calc(var(--gs-focus-width) * -1);
	}
	.tree-node-caret {
		display: inline-block;
		width: 1.5ch;
		color: var(--gs-syntax-comment);
		text-align: center;
		transition: transform var(--gs-duration) var(--gs-ease);
	}
	.key {
		color: var(--gs-syntax-default);
	}
`;
