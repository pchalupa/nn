import { createFileRoute } from '@tanstack/react-router';
import { Column } from '../components/Column';

// Mock data
const TODO = [
	{
		id: 'a',
		title: 'Design App',
		status: 'todo',
		description: 'Design the high fidelity of the application according to the wireframe',
	},
];
const IN_PROGRESS = [
	{
		id: 'a',
		title: 'Interview & Prototyping',
		status: 'in-progress',
		description: 'Do user interviews for several hours with several users who meet the criteria',
	},
];
const DONE = [
	{ id: 'a', title: 'Flow identification', status: 'done', description: 'Identify the app flow mentioned bellow' },
];

const Index = () => {
	return (
		<div className="flex flex-row">
			<div className="min-h-screen bg-sky-100">
				<h1 className="p-4 text-2xl font-bold">Kanban Board</h1>
			</div>
			<div className="flex h-full flex-row gap-x-2 p-4">
				<Column title="To Do" data={TODO} />
				<Column title="In Progress" data={IN_PROGRESS} />
				<Column title="Done" data={DONE} />
			</div>
		</div>
	);
};

export const Route = createFileRoute('/')({
	component: Index,
});
