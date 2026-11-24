import type { DraggableSyntheticListeners } from "@dnd-kit/core";
import { ChatCircleIcon, LinkIcon } from "@phosphor-icons/react";
import { Card, Flex, Text } from "@radix-ui/themes";
import { Link } from "@tanstack/react-router";
import type { Priority } from "example-schema";
import type { Ref } from "react";
import { useTranslation } from "react-i18next";

import { Assignee } from "@/features/board/components/assignee";
import { Label } from "@/features/board/components/label-badge";
import { PriorityIcon } from "@/features/board/components/priority/parts/priority-icon";
import { ticketKey } from "@/features/board/ticket-key";
import { priorityLabels } from "@/i18n";
import { useQuery } from "@/store";

/** Ticket fields a board card shows. */
export interface CardTicket {
	id: string;
	title: string;
	priority: Priority;
	assignee: string;
	labels: readonly string[];
	comments: readonly unknown[];
	links: readonly unknown[];
}

interface TicketCardProps {
	ticket: CardTicket;
	ref?: Ref<HTMLAnchorElement>;
	dragListeners?: DraggableSyntheticListeners;
	dragDescribedBy?: string;
}

/** Renders a board card linking to the ticket, keeping the current board filters. */
export const TicketCard = ({ ticket, ref, dragListeners, dragDescribedBy }: TicketCardProps) => {
	const { t } = useTranslation();
	const assignee = useQuery((data) => data.users.find((user) => user.id === ticket.assignee));

	return (
		<Card asChild size="1">
			<Link
				ref={ref}
				to="/tickets/$ticketId"
				params={{ ticketId: ticket.id }}
				search={true}
				draggable={false}
				aria-describedby={dragDescribedBy}
				style={{
					WebkitTouchCallout: "none",
					WebkitUserSelect: "none",
					userSelect: "none",
					touchAction: "manipulation",
				}}
				{...dragListeners}
			>
				<Flex direction="column" gap="2">
					<Flex justify="between" align="start" gap="2">
						<Text size="2" weight="medium">
							{ticket.title}
						</Text>
						<Text size="1" color="gray">
							{ticketKey(ticket.id)}
						</Text>
					</Flex>
					{ticket.labels.length > 0 && (
						<Flex wrap="wrap" gap="1">
							{ticket.labels.map((label) => (
								<Label key={label} name={label} />
							))}
						</Flex>
					)}
					<Flex align="center" gap="3">
						<Flex align="center" gap="1">
							<ChatCircleIcon size={12} color="var(--gray-a11)" />
							<Text size="1" color="gray">
								{ticket.comments.length}
							</Text>
						</Flex>
						<Flex align="center" gap="1">
							<LinkIcon size={12} color="var(--gray-a11)" />
							<Text size="1" color="gray">
								{ticket.links.length}
							</Text>
						</Flex>
						<PriorityIcon
							priority={ticket.priority}
							size={12}
							label={t("priorityName", { priority: t(priorityLabels[ticket.priority]) })}
						/>
						<Flex flexGrow="1" />
						<Assignee user={assignee} />
					</Flex>
				</Flex>
			</Link>
		</Card>
	);
};
