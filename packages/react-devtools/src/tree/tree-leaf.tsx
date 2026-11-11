import { isString } from "@nn/guards/is-string";

import { Text } from "../components/text";
import { css } from "../styles/css";

export interface TreeLeafProps {
	label: string;
	value: unknown;
	level: number;
}

export function TreeLeaf({ label, value, level }: TreeLeafProps) {
	const style: Record<string, number> = { "--level": level };
	const type = value === null ? "null" : typeof value;
	const serializedValue = isString(value) ? JSON.stringify(value) : String(value);

	return (
		<button type="button" role="treeitem" className="tree-node" aria-level={level} style={style}>
			<span className="tree-node-caret" aria-hidden="true" />
			<span className="key">{label}</span>
			<Text>: </Text>
			<span className="value" data-type={type}>
				{serializedValue}
			</span>
		</button>
	);
}

css`
	.tree-node:not([aria-expanded]) {
		cursor: default;
	}
	.value[data-type="string"] {
		color: var(--gs-syntax-string);
	}
	.value[data-type="number"],
	.value[data-type="bigint"],
	.value[data-type="boolean"] {
		color: var(--gs-syntax-keyword);
	}
	.value[data-type="null"],
	.value[data-type="undefined"] {
		color: var(--gs-syntax-comment);
	}
`;
