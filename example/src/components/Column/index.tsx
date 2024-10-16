import { useState } from 'react';
import { Ticket } from '../Ticket';

interface ColumnProps {
	title: string;
	initialData: { id: string; title: string; status: 'todo' | 'in-progress' | 'done' }[];
	onDrop?: (data: { title: string }) => void;
}

export const Column = ({ title, initialData, onDrop }: ColumnProps) => {
	const [data, setData] = useState(initialData);

	const handleDrop = (event: React.DragEvent) => {
		event.preventDefault();

		const data = event.dataTransfer.getData('text/plain');

		onDrop?.({ title: data });
		setData((current) => {
			current.push({ id: 'foo', title: data, status: 'todo' });

			return [...current];
		});
	};

	const handleDragOver = (event: React.DragEvent) => {
		event.preventDefault();
	};

	return (
		<section className="w-full border-4 py-4 px-2" onDrop={handleDrop} onDragOver={handleDragOver}>
			<h3 className="mb-2">{title}</h3>
			<div className="flex flex-col gap-y-2">
				{data.map(({ title }) => (
					<Ticket title={title} />
				))}
			</div>
		</section>
	);
};
