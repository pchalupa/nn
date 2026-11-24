import { Flex, Text } from "@radix-ui/themes";
import type { Priority as TicketPriority } from "example-schema";
import { useTranslation } from "react-i18next";

import { priorityLabels } from "@/i18n";

import { PriorityIcon } from "./parts/priority-icon";

interface PriorityProps {
	priority: TicketPriority;
}

/** Renders a ticket priority as icon and name. */
export const Priority = ({ priority }: PriorityProps) => {
	const { t } = useTranslation();

	return (
		<Flex gap="1" align="center">
			<PriorityIcon priority={priority} size={14} />
			<Text size="2" weight="medium">
				{t(priorityLabels[priority])}
			</Text>
		</Flex>
	);
};
