import { createFileRoute } from "@tanstack/react-router";
import { Column } from "../components/Column";

const Index = () => (
	<div className="flex h-full flex-1 flex-row gap-x-2 p-4">
		<Column title="To Do" status="todo" />
		<Column title="In Progress" status="in-progress" />
		<Column title="Done" status="done" />
	</div>
);

export const Route = createFileRoute("/")({
	component: Index,
});
