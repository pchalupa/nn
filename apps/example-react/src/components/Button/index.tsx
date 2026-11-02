import { type ButtonStyleVariants, classNames } from "./index.styles";

export interface ButtonProps extends ButtonStyleVariants {
	text: string;
	type?: "button" | "submit";
	disabled?: boolean;
	preserveFocus?: boolean;
	onClick?: () => void;
}

const preventFocus = (event: React.MouseEvent) => event.preventDefault();

export const Button = ({
	text,
	type = "button",
	disabled,
	preserveFocus,
	color,
	size,
	rounded,
	onClick,
}: ButtonProps) => (
	<button
		type={type}
		disabled={disabled}
		className={classNames({ color, size, rounded })}
		onMouseDown={preserveFocus ? preventFocus : undefined}
		onClick={onClick}
	>
		{text}
	</button>
);
