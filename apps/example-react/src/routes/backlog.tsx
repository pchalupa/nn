import { createFileRoute } from "@tanstack/react-router";
import { Ticket } from "../components/Ticket";
import { useStore } from "../store";

const Backlog = () => {
	const data = useStore((store) => store.tickets);

	return (
		<div className="flex-1 p-2">
			<div className="flex min-h-screen flex-1 flex-col gap-y-2 p-4">
				{data.map((ticket) => (
					<Ticket key={ticket.id} title={ticket.title} description={ticket.description} />
				))}
			</div>
		</div>
	);
};

export const Route = createFileRoute("/backlog")({
	component: Backlog,
});
