import { PlusIcon } from "@phosphor-icons/react";
import { Button } from "@radix-ui/themes";
import type { ReactNode } from "react";

interface TagProps {
	children: ReactNode;
	onClick: () => void;
}

/** Renders a compact outlined button that adds something. */
export const Tag = ({ children, onClick }: TagProps) => (
	<Button type="button" size="1" variant="outline" color="gray" onClick={onClick}>
		<PlusIcon size={12} />
		{children}
	</Button>
);
