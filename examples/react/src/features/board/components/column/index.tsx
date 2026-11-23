import { Card, Flex, Reset, Text } from "@radix-ui/themes";
import type { Status as TicketStatus } from "example-schema";

import { useUser } from "@/features/authentication/authentication";
import { type BoardSearch, matchesBoardSearch } from "@/features/board/board-search";
import { Status } from "@/features/board/components/status";
import { TicketCard } from "@/features/board/components/ticket-card";
import { useQuery } from "@/store";

interface ColumnProps {
	title: string;
	status: TicketStatus;
	search: BoardSearch;
}

/** Renders a board column with the tickets of one status that pass the board filters. */
export const Column = ({ title, status, search }: ColumnProps) => {
	const { id: userId } = useUser();
	const tickets = useQuery((data) =>
		data.tickets.filter((ticket) => ticket.status === status && matchesBoardSearch(ticket, search, userId)),
	);

	return (
		<Flex asChild direction="column" gap="2" minHeight="0">
			<Card asChild size="1">
				<section aria-label={title}>
					<Flex align="center" gap="2" pl="2" pr="1" height="32px" flexShrink="0">
						<Status status={status} />
						<Text size="1" color="gray">
							{tickets.length}
						</Text>
					</Flex>
					<Flex asChild direction="column" gap="2" overflowY="auto" flexShrink="1">
						<Reset>
							<ul>
								{tickets.map((ticket) => (
									<li key={ticket.id}>
										<TicketCard ticket={ticket} />
									</li>
								))}
							</ul>
						</Reset>
					</Flex>
				</section>
			</Card>
		</Flex>
	);
};
