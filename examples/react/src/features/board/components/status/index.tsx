import { Flex, Text } from "@radix-ui/themes";
import type { Status as TicketStatus } from "example-schema";
import { useTranslation } from "react-i18next";

import { statusLabels } from "@/i18n";

import { StatusIcon } from "./parts/status-icon";

interface StatusProps {
	status: TicketStatus;
}

/** Renders a ticket status as icon and name. */
export const Status = ({ status }: StatusProps) => {
	const { t } = useTranslation();

	return (
		<Flex gap="1" align="center">
			<StatusIcon status={status} size={14} />
			<Text size="2" weight="medium">
				{t(statusLabels[status])}
			</Text>
		</Flex>
	);
};
