import { Flex } from "@radix-ui/themes";
import type { ReactNode } from "react";

interface AssigneeOptionProps {
	avatar: ReactNode;
	name: string;
}

/** Renders an assignee choice as its avatar beside the name. */
export const AssigneeOption = ({ avatar, name }: AssigneeOptionProps) => (
	<Flex as="span" align="center" gap="2">
		{avatar}
		{name}
	</Flex>
);
