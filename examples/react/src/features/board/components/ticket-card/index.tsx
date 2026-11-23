import { ChatCircleIcon, LinkIcon } from "@phosphor-icons/react";
import { Card, Flex, Text } from "@radix-ui/themes";
import { Link } from "@tanstack/react-router";

import { Assignee } from "@/features/board/components/assignee";
import { Label } from "@/features/board/components/label-badge";
import { ticketKey } from "@/features/board/ticket-key";
import { useQuery } from "@/store";

interface TicketCardProps {
	ticket: {
		id: string;
		title: string;
		assignee: string;
		labels: readonly string[];
		comments: readonly unknown[];
		links: readonly unknown[];
	};
}

/** Renders a board card linking to the ticket, keeping the current board filters. */
export const TicketCard = ({ ticket }: TicketCardProps) => {
	const assignee = useQuery((data) => data.users.find((user) => user.id === ticket.assignee));

	return (
		<Card asChild size="1">
			<Link to="/tickets/$ticketId" params={{ ticketId: ticket.id }} search={true}>
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
						<Flex flexGrow="1" />
						<Assignee user={assignee} />
					</Flex>
				</Flex>
			</Link>
		</Card>
	);
};
