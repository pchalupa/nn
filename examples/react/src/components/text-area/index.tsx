import type { ComponentProps } from "react";

import { classNames } from "./index.styles";

interface TextAreaProps extends Omit<ComponentProps<"textarea">, "className"> {
	label: string;
}

export const TextArea = ({ label, ...props }: TextAreaProps) => {
	const styles = classNames();

	return (
		<label className={styles.label()}>
			{label}
			<textarea className={styles.textArea()} {...props} />
		</label>
	);
};
