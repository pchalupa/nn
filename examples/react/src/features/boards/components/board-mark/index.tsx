import { KanbanIcon } from "@phosphor-icons/react";
import { Flex } from "@radix-ui/themes";

/** Renders a board's 32px mark with the Kanban icon. */
export const BoardMark = () => (
	<Flex
		align="center"
		justify="center"
		width="32px"
		height="32px"
		flexShrink="0"
		aria-hidden
		style={{ background: "var(--accent-a3)", borderRadius: "var(--radius-3)" }}
	>
		<KanbanIcon size={16} color="var(--accent-11)" />
	</Flex>
);
