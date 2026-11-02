import type { ComponentProps } from "react";

import { classNames, type InputStyleVariants } from "./index.styles";

interface InputProps extends Omit<ComponentProps<"input">, "className" | "size">, InputStyleVariants {
	label: string;
}

export const Input = ({ label, size, ...props }: InputProps) => {
	const styles = classNames({ size });

	return (
		<label className={styles.label()}>
			{label}
			<input className={styles.input()} {...props} />
		</label>
	);
};
