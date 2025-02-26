import { useStore } from "../../store";
import { Ticket } from "../Ticket";
import { Header } from "./parts/Header";

interface ColumnProps {
	title: string;
	status: "todo" | "in-progress" | "done";
	onAddClick?: () => void;
}

export const Column = ({ title, status }: ColumnProps) => {
	const data = useStore((store) => store.tickets.filter((ticket) => ticket.status === status));

	const handleOnCLick = () => {
		data.push({ id: Math.random().toString(), title: status, status, description: "test" });
	};

	return (
		<section className="flex w-full flex-col gap-y-2 rounded bg-sky-100 px-2 py-4">
			<Header title={title} onAddClick={handleOnCLick} />
			<hr className="border-sky-600" />
			<div className="flex flex-col gap-y-2">
				{data.map((data) => (
					<Ticket key={data.id} title={data?.title} description={data?.description} />
				))}
			</div>
		</section>
	);
};
