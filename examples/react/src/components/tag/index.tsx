import { PlusIcon } from "@phosphor-icons/react";
import { Badge, Link } from "@radix-ui/themes";
import type { ReactNode, Ref } from "react";

interface TagProps {
	ref?: Ref<HTMLButtonElement>;
	children: ReactNode;
	onClick: () => void;
}

/** Renders a compact outlined button that adds something. */
export const Tag = ({ ref, children, onClick }: TagProps) => (
	<Badge asChild size="1" variant="outline" color="gray">
		<Link asChild underline="none" color="gray" weight="regular">
			<button ref={ref} type="button" onClick={onClick}>
				<PlusIcon size={12} />
				{children}
			</button>
		</Link>
	</Badge>
);
