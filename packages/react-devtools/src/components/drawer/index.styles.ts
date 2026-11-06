import { css } from "../../css";

export const styles = css`
	.drawer {
		position: fixed;
		right: 0;
		bottom: 0;
		left: 0;
		z-index: var(--z);
		display: flex;
		flex-direction: column;
		height: 40vh;
		border-top: 1px solid var(--border);
		color: var(--fg);
		background: var(--bg);
		line-height: 1.5;
		box-shadow: 0 -2px 12px var(--shadow);
	}
	.drawer-bar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: var(--space-2) var(--space-3);
		border-bottom: 1px solid var(--border);
	}
`;
