import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router";

import { TicketModal } from "../components/TicketModal";

const BacklogTicket = () => {
	const { ticketId } = useParams({ from: "/backlog/tickets/$ticketId" });
	const navigate = useNavigate();

	const handleClose = () => navigate({ to: "/backlog" });

	return <TicketModal key={ticketId} id={ticketId} onClose={handleClose} />;
};

export const Route = createFileRoute("/backlog/tickets/$ticketId")({
	component: BacklogTicket,
});
