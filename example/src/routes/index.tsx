import { createFileRoute } from '@tanstack/react-router';
import { useStore } from '../store';
import { Column } from '../components/Column';

const Stats = () => {
	const data = useStore((store) => store.tickets);

	return (
		<div className="flex flex-col gap-y-2">
			<h3 className="text-sm uppercase">Stats</h3>
			<hr className="border-sky-600" />
			<div className="flex flex-col gap-y-2">{data.length}</div>
		</div>
	);
};

const Index = () => {
	return (
		<div className="flex flex-row">
			<div className="min-h-screen bg-sky-100">
				<h1 className="p-4 text-2xl font-bold">Kanban Board</h1>
				<Stats />
			</div>
			<div className="flex h-full flex-1 flex-row gap-x-2 p-4">
				<Column title="To Do" status="todo" />
				<Column title="In Progress" status="in-progress" />
				<Column title="Done" status="done" />
			</div>
		</div>
	);
};

export const Route = createFileRoute('/')({
	component: Index,
});
