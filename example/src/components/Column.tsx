import { Button } from './Button';
import { Ticket } from './Ticket';

interface ColumnProps {
	title: string;
	data: { id: string; title: string; description: string }[];
	onAddClick?: () => void;
}

export const Column = ({ title, data, onAddClick }: ColumnProps) => (
	<section className="flex w-full flex-col gap-y-2 rounded bg-sky-100 px-2 py-4">
		<div className="flex flex-row items-center justify-between">
			<h3 className="text-sm uppercase">{title}</h3>
			<Button text="+" onClick={onAddClick} />
		</div>
		<hr className="border-sky-600" />
		<div className="flex flex-col gap-y-2">
			{data.map(({ title, description }) => (
				<Ticket title={title} description={description} />
			))}
		</div>
	</section>
);
