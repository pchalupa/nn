import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router";

import { TicketModal } from "../components/TicketModal";

const BoardTicket = () => {
	const { ticketId } = useParams({ from: "/_board/tickets/$ticketId" });
	const navigate = useNavigate();

	const handleClose = () => navigate({ to: "/" });

	return <TicketModal id={ticketId} onClose={handleClose} />;
};

export const Route = createFileRoute("/_board/tickets/$ticketId")({
	component: BoardTicket,
});
