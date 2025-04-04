import { createFileRoute } from "@tanstack/react-router";
import { Column } from "../components/Column";
import { Skeleton } from "../components/Skeleton";

const Index = () => (
	<div className="flex h-full flex-1 flex-row gap-x-2 overflow-x-scroll p-4">
		<Skeleton width="w-full" height="h-56">
			<Column title="To Do" status="todo" />
		</Skeleton>
		<Skeleton width="w-full" height="h-56">
			<Column title="In Progress" status="in-progress" />
		</Skeleton>
		<Skeleton width="w-full" height="h-56">
			<Column title="Done" status="done" />
		</Skeleton>
	</div>
);

export const Route = createFileRoute("/")({
	component: Index,
});
