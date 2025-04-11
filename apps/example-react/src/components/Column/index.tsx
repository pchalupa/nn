import { useStore } from "../../store";
import { Divider } from "../Divider";
import { Ticket } from "../Ticket";
import { Header } from "./parts/Header";

interface ColumnProps {
	title: string;
	status: "todo" | "in-progress" | "done";
	onAddClick?: () => void;
}

export const Column = ({ title, status }: ColumnProps) => {
	const data = useStore((store) => store.tickets.filter((ticket) => ticket.status === status));

	const handleAddClick = () => {
		data.push({ id: crypto.randomUUID(), title: status, status, description: "test" });
	};

	return (
		<section className="flex w-full min-w-50 flex-col gap-y-2 rounded bg-zinc-800 px-2 py-4">
			<Header title={title} onAddClick={handleAddClick} />
			<Divider />
			<div className="flex flex-col gap-y-2">
				{data.map((data) => (
					<Ticket key={data.id} title={data?.title} description={data?.description} />
				))}
			</div>
		</section>
	);
};
