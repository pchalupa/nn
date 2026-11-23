import { Card, Flex, Heading } from "@radix-ui/themes";
import { Link } from "@tanstack/react-router";
import type { Status } from "example-schema";

import { useQuery } from "../../store";
import { Ticket } from "../ticket";

interface ColumnProps {
	title: string;
	status: Status;
}

export const Column = ({ title, status }: ColumnProps) => {
	const tickets = useQuery((data) =>
		data.tickets.reduce<Array<{ id: string; title: string; description: string; assignee?: string }>>(
			(result, ticket) => {
				if (ticket.status === status) {
					result.push({
						id: ticket.id,
						title: ticket.title,
						description: ticket.description,
						assignee: data.users.find((user) => user.id === ticket.assignee)?.name,
					});
				}

				return result;
			},
			[],
		),
	);

	return (
		<Card>
			<Flex direction="column" gap="2">
				<Heading as="h3" size="2">
					{title}
				</Heading>
				<Flex asChild direction="column" gap="2" m="0" p="0" style={{ listStyle: "none" }}>
					<ul aria-label={title}>
						{tickets.map((data) => (
							<li key={data.id}>
								<Card asChild>
									<Link to="/tickets/$ticketId" params={{ ticketId: data.id }} aria-label={data.title}>
										<Ticket title={data.title} description={data.description} assignee={data.assignee} />
									</Link>
								</Card>
							</li>
						))}
					</ul>
				</Flex>
			</Flex>
		</Card>
	);
};
