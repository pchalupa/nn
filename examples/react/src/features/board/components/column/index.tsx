import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { Card, Flex, Reset, Text } from "@radix-ui/themes";
import type { Status as TicketStatus } from "example-schema";

import { SortableTicket } from "@/features/board/components/sortable-ticket";
import { Status } from "@/features/board/components/status";
import type { CardTicket } from "@/features/board/components/ticket-card";

interface ColumnProps {
	boardId: string;
	title: string;
	status: TicketStatus;
	tickets: readonly CardTicket[];
}

/** Renders a board column of draggable cards that also accepts cards dropped on its empty space. */
export const Column = ({ boardId, title, status, tickets }: ColumnProps) => {
	const { setNodeRef } = useDroppable({ id: status });

	return (
		<Flex asChild direction="column" gap="2" minHeight="0">
			<Card asChild size="1">
				<section ref={setNodeRef} aria-label={title}>
					<Flex align="center" gap="2" pl="2" pr="1" height="32px" flexShrink="0">
						<Status status={status} />
						<Text size="1" color="gray">
							{tickets.length}
						</Text>
					</Flex>
					<Flex asChild direction="column" gap="2" overflowY="auto" flexShrink="1">
						<Reset>
							<ul>
								<SortableContext items={tickets.map((ticket) => ticket.id)} strategy={verticalListSortingStrategy}>
									{tickets.map((ticket) => (
										<SortableTicket key={ticket.id} boardId={boardId} ticket={ticket} />
									))}
								</SortableContext>
							</ul>
						</Reset>
					</Flex>
				</section>
			</Card>
		</Flex>
	);
};
