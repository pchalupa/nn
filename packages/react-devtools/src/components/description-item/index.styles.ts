import { css } from "../../css";

export const styles = css`
	.description-list > dt {
		color: var(--fg-muted);
	}
	.description-list > dd {
		margin: 0;
		min-width: 0;
	}
	.description-list > dd[data-variant="raw"] {
		overflow-wrap: anywhere;
		user-select: all;
	}
	.description-list > dd[data-variant="muted"] {
		color: var(--fg-muted);
	}
`;
