import { Link } from "@tanstack/react-router";
import type { Status } from "example-schema";

import { useRead } from "../../store";
import { Divider } from "../divider";
import { Ticket } from "../ticket";
import { Header } from "./parts/header";

interface ColumnProps {
	title: string;
	status: Status;
}

export const Column = ({ title, status }: ColumnProps) => {
	const tickets = useRead((data) =>
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
		<section className="flex w-full min-w-50 flex-col gap-y-2 rounded bg-zinc-800 px-2 py-4">
			<Header title={title} />
			<Divider />
			<div className="flex flex-col gap-y-2">
				{tickets.map((data) => (
					<Link key={data.id} to="/tickets/$ticketId" params={{ ticketId: data.id }} aria-label={data.title}>
						<Ticket title={data.title} description={data.description} assignee={data.assignee} />
					</Link>
				))}
			</div>
		</section>
	);
};
