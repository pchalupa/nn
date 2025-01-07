import { classNames, ButtonStyleVariants } from './index.styles';

export interface ButtonProps extends ButtonStyleVariants {
	text: string;
	onClick?: () => void;
}

export const Button = ({ text, color, size, rounded, onClick }: ButtonProps) => (
	<button type="button" className={classNames({ color, size, rounded })} onClick={onClick}>
		{text}
	</button>
);
