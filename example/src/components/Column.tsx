import { Ticket } from './Ticket';

interface ColumnProps {
	title: string;
	data: { id: string; title: string; status: string }[];
}

export const Column = ({ title, data }: ColumnProps) => (
	<section className="w-full border-4 px-2 py-4">
		<h3 className="mb-2">{title}</h3>
		<div className="flex flex-col gap-y-2">
			{data.map(({ title }) => (
				<Ticket title={title} description="test" status="test" />
			))}
		</div>
	</section>
);
