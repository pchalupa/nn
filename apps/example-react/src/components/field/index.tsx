import type { ReactElement } from "react";

import { classNames } from "./field.styles";

interface FieldProps {
	label: string;
	hint?: string;
	caption?: boolean;
	className?: string;
	children: ReactElement;
}

export const Field = ({ label, hint, caption, className, children }: FieldProps) => {
	const styles = classNames({ caption });

	return (
		<div className={styles.base({ className })}>
			<label className={styles.base({ className: "flex-1" })}>
				<span className={styles.label()}>{label}</span>
				{children}
			</label>
			{hint && <span className={styles.hint()}>{hint}</span>}
		</div>
	);
};
