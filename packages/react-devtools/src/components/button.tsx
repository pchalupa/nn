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
		padding: var(--space-1) var(--space-3);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		color: inherit;
		background: transparent;
		font: inherit;
		cursor: pointer;
	}
	.button:hover {
		background: var(--hover);
	}
	.button:focus-visible {
		outline: 1px solid var(--focus);
		outline-offset: 1px;
	}
	.button[data-variant="floating"] {
		position: fixed;
		right: var(--space-4);
		bottom: var(--space-4);
		z-index: var(--z);
		padding: var(--space-3) var(--space-4);
		border-radius: 999px;
		color: var(--accent);
		background: var(--bg);
		font-weight: bold;
		box-shadow: 0 2px 8px var(--shadow);
	}
	.button[data-variant="floating"]:hover {
		background: var(--bg-raised);
	}
`;
