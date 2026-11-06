export interface ButtonProps {
	text: string;
	label?: string;
	variant?: "outlined" | "floating";
	onClick?: () => void;
}

export function Button({ text, label, variant = "outlined", onClick }: ButtonProps) {
	return (
		<button type="button" className="button" data-variant={variant} aria-label={label} onClick={onClick}>
			{text}
		</button>
	);
}
