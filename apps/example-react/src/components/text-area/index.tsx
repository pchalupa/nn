import type { ComponentProps } from "react";

import { classNames } from "./text-area.styles";

export const TextArea = ({ className, ...props }: ComponentProps<"textarea">) => (
	<textarea className={classNames({ className })} {...props} />
);
