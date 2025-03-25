import { createFileRoute } from "@tanstack/react-router";
import { Suspense } from "react";
import { Column } from "../components/Column";
import { Skeleton } from "../components/Skeleton";

const Index = () => (
	<div className="flex h-full flex-1 flex-row gap-x-2 p-4">
		<Suspense fallback={<Skeleton width="w-full" height="h-56" />}>
			<Column title="To Do" status="todo" />
		</Suspense>
		<Suspense fallback={<Skeleton width="w-full" height="h-56" />}>
			<Column title="In Progress" status="in-progress" />
		</Suspense>
		<Suspense fallback={<Skeleton width="w-full" height="h-56" />}>
			<Column title="Done" status="done" />
		</Suspense>
	</div>
);

export const Route = createFileRoute("/")({
	component: Index,
});
