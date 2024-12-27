import { createFileRoute } from '@tanstack/react-router';
import { Column } from '../components/Column';

// Mock data
const TODO = [{ id: 'foo', title: 'Test', status: 'todo' }];
const IN_PROGRESS = [{ id: 'foo', title: 'Test', status: 'in-progress' }];
const DONE = [{ id: 'foo', title: 'Test', status: 'done' }];

const Index = () => (
	<div className="flex flex-row h-full gap-x-2">
		<Column title="To-Do" data={TODO} />
		<Column title="In Progress" data={IN_PROGRESS} />
		<Column title="Done" data={DONE} />
	</div>
);

export const Route = createFileRoute('/')({
	component: Index,
});
