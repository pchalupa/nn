import { css } from "../../css";

export const styles = css`
	.pane {
		flex: 1;
		min-width: 0;
		padding: var(--space-3);
		overflow: auto;
		scrollbar-width: thin;
		scrollbar-color: var(--border) transparent;
	}
`;
