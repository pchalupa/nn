import { isArray } from "@nn/guards/is-array";
import { type ReactNode, useState } from "react";

import { Text } from "../components/text";
import { css } from "../styles/css";

export interface TreeBranchProps {
	label: string;
	value: object;
	level: number;
	children: () => ReactNode;
}

export function TreeBranch({ label, value, level, children }: TreeBranchProps) {
	const [expanded, setExpanded] = useState(false);
	const style: Record<string, number> = { "--level": level };
	const expandable = Object.keys(value).length > 0;
	const open = expandable && expanded;

	const handleClick = () => {
		if (expandable) setExpanded((current) => !current);
	};

	return (
		<>
			<button
				type="button"
				role="treeitem"
				className="tree-node"
				aria-level={level}
				aria-expanded={expandable ? open : undefined}
				style={style}
				onClick={handleClick}
			>
				<span className="tree-node-caret" aria-hidden="true">
					{expandable && "▸"}
				</span>
				<span className="key">{label}</span>
				{isArray(value) && <Text> [{value.length}]</Text>}
			</button>
			{open && <div role="group">{children()}</div>}
		</>
	);
}

css`
	.tree-node[aria-expanded="true"] > .tree-node-caret {
		transform: rotate(90deg);
	}
`;
