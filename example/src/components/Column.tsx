import { useStore } from '../store';
import { Button } from './Button';
import { Ticket } from './Ticket';

interface ColumnProps {
	title: string;
	status: 'todo' | 'in-progress' | 'done';
	onAddClick?: () => void;
}

export const Column = ({ title, status }: ColumnProps) => {
	const data = useStore((store) => store.tickets.filter((doc) => doc?.data?.status === status));

	const handleOnCLick = () => {
		data.push({
			id: `test-${Math.random()}`,
			data: { id: Math.random().toString(), title: status, status, description: 'test' },
		});
	};

	return (
		<section className="flex w-full flex-col gap-y-2 rounded bg-sky-100 px-2 py-4">
			<div className="flex flex-row items-center justify-between">
				<h3 className="text-sm uppercase">{title}</h3>
				<Button text="+" onClick={handleOnCLick} />
			</div>
			<hr className="border-sky-600" />
			<div className="flex flex-col gap-y-2">
				{data.map(({ data }) => (
					<Ticket key={data.id} title={data?.title} description={data?.description} />
				))}
			</div>
		</section>
	);
};
