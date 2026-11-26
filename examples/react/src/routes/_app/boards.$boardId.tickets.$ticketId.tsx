import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router";

import { TicketModal } from "@/features/board/components/ticket-modal";

const BoardTicket = () => {
	const { boardId, ticketId } = useParams({ from: "/_app/boards/$boardId/tickets/$ticketId" });
	const navigate = useNavigate();

	const handleClose = () => navigate({ to: "/boards/$boardId", params: { boardId }, search: true });

	return <TicketModal key={ticketId} boardId={boardId} id={ticketId} onClose={handleClose} />;
};

export const Route = createFileRoute("/_app/boards/$boardId/tickets/$ticketId")({
	component: BoardTicket,
	wrapInSuspense: true,
});
