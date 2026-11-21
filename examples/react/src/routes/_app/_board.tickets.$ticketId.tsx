import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router";

import { TicketModal } from "../../components/ticket-modal";

const BoardTicket = () => {
	const { ticketId } = useParams({ from: "/_app/_board/tickets/$ticketId" });
	const navigate = useNavigate();

	const handleClose = () => navigate({ to: "/" });

	return <TicketModal id={ticketId} onClose={handleClose} />;
};

export const Route = createFileRoute("/_app/_board/tickets/$ticketId")({
	component: BoardTicket,
	wrapInSuspense: true,
});
