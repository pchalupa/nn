import { isObject } from "@nn/guards/is-object";
import type { Store } from "@nn/store";

import { useStore } from "../hooks/use-store";
import { css } from "../styles/css";
import { TreeNode } from "./tree-node";

export interface TreeProps {
	store: Store;
}

export function Tree({ store }: TreeProps) {
	const value = useStore(store);
	const nodes = isObject(value) ? Object.entries(value) : [];

	return (
		<div role="tree" aria-label="Store" className="tree">
			{nodes.map(([segment, field]) => (
				<TreeNode key={segment} label={segment} value={field} level={1} />
			))}
		</div>
	);
}

css`
	.tree {
		flex: 1;
		min-height: 0;
		padding: var(--space-3);
		overflow: auto;
		scrollbar-width: thin;
		scrollbar-color: var(--border) transparent;
	}
`;
