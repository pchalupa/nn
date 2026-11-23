import { CheckCircleIcon, CircleDashedIcon, RadioButtonIcon } from "@phosphor-icons/react";
import type { Status as TicketStatus } from "example-schema";

import { CircleDottedIcon } from "./circle-dotted-icon";

interface StatusIconProps {
	status: TicketStatus;
	size: 12 | 14;
}

/** Renders the icon of a ticket status in its status color. */
export const StatusIcon = ({ status, size }: StatusIconProps) => {
	if (status === "in-progress") return <RadioButtonIcon size={size} color="var(--blue-11)" />;

	if (status === "done") return <CheckCircleIcon size={size} color="var(--green-11)" />;

	if (status === "backlog") return <CircleDottedIcon size={size} color="var(--gray-11)" />;

	return <CircleDashedIcon size={size} color="var(--gray-a11)" />;
};
