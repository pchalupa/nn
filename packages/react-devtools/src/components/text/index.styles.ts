import { css } from "../../css";

export const styles = css`
	p.text {
		margin: 0 0 var(--space-3);
	}
	.text[data-tone="muted"] {
		color: var(--fg-muted);
	}
	.text[data-tone="accent"] {
		color: var(--accent);
	}
`;
