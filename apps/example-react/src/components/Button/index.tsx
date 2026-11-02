import { type ButtonStyleVariants, classNames } from "./index.styles";

export interface ButtonProps extends ButtonStyleVariants {
	text: string;
	type?: "button" | "submit";
	onClick?: () => void;
}

export const Button = ({ text, type = "button", color, size, rounded, onClick }: ButtonProps) => (
	<button type={type} className={classNames({ color, size, rounded })} onClick={onClick}>
		{text}
	</button>
);
