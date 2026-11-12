import { css } from "../styles/css";

export interface ButtonProps {
	text: string;
	label?: string;
	variant?: "outlined" | "floating";
	onClick?: () => void;
}

export function Button({ text, label, variant, onClick }: ButtonProps) {
	return (
		<button type="button" className="button" data-variant={variant ?? "outlined"} aria-label={label} onClick={onClick}>
			{text}
		</button>
	);
}

css`
	.button {
		min-height: 28px;
		padding: var(--gs-space-1) var(--gs-space-2-5);
		border: var(--gs-border-width) solid var(--gs-panel-label);
		border-radius: 0;
		color: var(--gs-panel-text);
		background: transparent;
		font: inherit;
		line-height: var(--gs-leading-label);
		letter-spacing: var(--gs-tracking-label);
		text-transform: uppercase;
		cursor: pointer;
		transition:
			color var(--gs-duration-fast) var(--gs-ease),
			background-color var(--gs-duration-fast) var(--gs-ease);
	}
	.button:hover {
		color: var(--gs-panel-bg);
		background: var(--gs-panel-text);
	}
	.button:focus-visible {
		outline: var(--gs-focus-width) solid var(--gs-panel-focus);
		outline-offset: var(--gs-focus-offset);
	}
	.button[data-variant="floating"] {
		position: fixed;
		right: var(--gs-space-4);
		bottom: var(--gs-space-4);
		z-index: var(--z);
		padding: var(--gs-space-2) var(--gs-space-3);
		background: var(--gs-panel-bg);
	}
	.button[data-variant="floating"]:hover {
		color: var(--gs-panel-text);
		background: var(--gs-panel-bg-raised);
	}
`;
