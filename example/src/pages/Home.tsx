import { Column } from '../components/Column';
import { tickets } from '../services/data';

export const Home = () => {
	const todo = tickets.filter(({ status }) => {
		console.log(status);
		return status === 'todo';
	});
	const inProgress = tickets.filter(({ status }) => status === 'in-progress');
	const done = tickets.filter(({ status }) => status === 'done');

	return (
		<div className="flex flex-row h-full gap-x-2">
			<Column
				title="To-Do"
				initialData={todo}
				onDrop={(data) => {
					tickets.push({ id: 'foo', title: data.title, status: 'todo' });
				}}
			/>
			<Column title="In Progress" initialData={inProgress} />
			<Column title="Done" initialData={done} />
		</div>
	);
};
