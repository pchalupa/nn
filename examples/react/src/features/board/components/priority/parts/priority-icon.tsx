import { CaretDownIcon, CaretUpIcon, EqualsIcon } from "@phosphor-icons/react";
import type { Priority as TicketPriority } from "example-schema";

interface PriorityIconProps {
	priority: TicketPriority;
	size: 12 | 14;
	label?: string;
}

/** Renders the icon of a ticket priority in its priority color, named by `label` when no text sits beside it. */
export const PriorityIcon = ({ priority, size, label }: PriorityIconProps) => {
	let role: "img" | undefined;
	let hidden: true | undefined = true;

	if (label !== undefined) {
		role = "img";
		hidden = undefined;
	}

	const props = { size, role, "aria-label": label, "aria-hidden": hidden };

	if (priority === "high") return <CaretUpIcon {...props} color="var(--orange-11)" />;

	if (priority === "medium") return <EqualsIcon {...props} color="var(--gray-a11)" />;

	return <CaretDownIcon {...props} color="var(--gray-a11)" />;
};
