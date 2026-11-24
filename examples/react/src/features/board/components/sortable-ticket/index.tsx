import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Box } from "@radix-ui/themes";

import { type CardTicket, TicketCard } from "@/features/board/components/ticket-card";

interface SortableTicketProps {
	ticket: CardTicket;
}

/** Renders a draggable board card that leaves a drop placeholder of its size while it is dragged. */
export const SortableTicket = ({ ticket }: SortableTicketProps) => {
	const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
		id: ticket.id,
	});

	return (
		<li ref={setNodeRef} style={{ transform: CSS.Translate.toString(transform), transition }}>
			<Box
				style={
					isDragging
						? {
								backgroundColor: "var(--accent-a3)",
								boxShadow: "inset 0 0 0 1px var(--focus-8)",
								borderRadius: "var(--radius-4)",
							}
						: undefined
				}
			>
				<Box style={isDragging ? { visibility: "hidden" } : undefined}>
					<TicketCard
						ticket={ticket}
						ref={setActivatorNodeRef}
						dragListeners={listeners}
						dragDescribedBy={attributes["aria-describedby"]}
					/>
				</Box>
			</Box>
		</li>
	);
};
