import { createFileRoute, Link, Outlet } from "@tanstack/react-router";

import { Ticket } from "../../components/ticket";
import { useRead } from "../../store";

const Backlog = () => {
	const tickets = useRead((data) =>
		data.tickets.map((ticket) => ({
			...ticket,
			assignee: data.users.find((user) => user.id === ticket.assignee)?.name,
		})),
	);

	return (
		<div className="flex-1 p-2">
			<div className="flex min-h-screen flex-1 flex-col gap-y-2 p-4">
				{tickets.map((ticket) => (
					<Link
						key={ticket.id}
						to="/backlog/tickets/$ticketId"
						params={{ ticketId: ticket.id }}
						aria-label={ticket.title}
					>
						<Ticket title={ticket.title} description={ticket.description} assignee={ticket.assignee} />
					</Link>
				))}
			</div>
			<Outlet />
		</div>
	);
};

export const Route = createFileRoute("/_app/backlog")({
	component: Backlog,
});
