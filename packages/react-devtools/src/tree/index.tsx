import { isObject } from "@goodstate/guards/is-object";
import type { ReactNode } from "react";

import { useStore } from "../hooks/use-store";
import type { Inspectable } from "../inspectable";
import { css } from "../styles/css";
import { TreeNode } from "./tree-node";

export interface TreeProps {
	store: Inspectable;
}

export function Tree({ store }: TreeProps): ReactNode {
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
		overflow: auto;
		scrollbar-width: thin;
		scrollbar-color: var(--gs-panel-border) transparent;
	}
`;
