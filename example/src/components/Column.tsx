import { Ticket } from './Ticket';

interface ColumnProps {
	title: string;
	data: { id: string; title: string; status: 'todo' | 'in-progress' | 'done' }[];
	onDrop?: (data: { title: string }) => void;
}

export const Column = ({ title, data, onDrop }: ColumnProps) => (
	<section className="w-full border-4 py-4 px-2">
		<h3 className="mb-2">{title}</h3>
		<div className="flex flex-col gap-y-2">
			{data.map(({ title }) => (
				<Ticket title={title} description="test" status="test" />
			))}
		</div>
	</section>
);
