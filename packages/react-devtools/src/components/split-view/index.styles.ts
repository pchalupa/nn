import { css } from "../../css";

export const styles = css`
	.split-view {
		display: flex;
		flex: 1;
		min-height: 0;
	}
	.split-view > :last-child:not(:first-child) {
		flex: 0 0 40%;
		border-left: 1px solid var(--border);
	}
	@media (max-width: 600px) {
		.split-view {
			flex-direction: column;
		}
		.split-view > :last-child:not(:first-child) {
			border-top: 1px solid var(--border);
			border-left: 0;
		}
	}
`;
