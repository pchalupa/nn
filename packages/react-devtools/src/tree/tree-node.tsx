import { isObject } from "@nn/guards/is-object";

import { css } from "../styles/css";
import { TreeBranch } from "./tree-branch";
import { TreeLeaf } from "./tree-leaf";

export interface TreeNodeProps {
	label: string;
	value: unknown;
	level: number;
}

export function TreeNode({ label, value, level }: TreeNodeProps) {
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
	.tree-node:hover {
		background: var(--hover);
	}
	.tree-node:focus-visible {
		outline: 1px solid var(--focus);
		outline-offset: -1px;
	}
	.tree-node-caret {
		display: inline-block;
		width: 1.5ch;
		color: var(--fg-muted);
		text-align: center;
		transition: transform 0.1s ease-out;
	}
	.key {
		color: var(--syntax-key);
	}
`;
