import { Box, Card, Flex } from "@radix-ui/themes";
import { createFileRoute, Link, Outlet } from "@tanstack/react-router";

import { Ticket } from "../../components/ticket";
import { useQuery } from "../../store";

const Backlog = () => {
	const tickets = useQuery((data) =>
		data.tickets.map((ticket) => ({
			...ticket,
			assignee: data.users.find((user) => user.id === ticket.assignee)?.name,
		})),
	);

	return (
		<Box flexGrow="1" p="4">
			<Flex asChild direction="column" gap="2" m="0" p="0" style={{ listStyle: "none" }}>
				<ul>
					{tickets.map((ticket) => (
						<li key={ticket.id}>
							<Card asChild>
								<Link to="/backlog/tickets/$ticketId" params={{ ticketId: ticket.id }} aria-label={ticket.title}>
									<Ticket title={ticket.title} description={ticket.description} assignee={ticket.assignee} />
								</Link>
							</Card>
						</li>
					))}
				</ul>
			</Flex>
			<Outlet />
		</Box>
	);
};

export const Route = createFileRoute("/_app/backlog")({
	component: Backlog,
});
