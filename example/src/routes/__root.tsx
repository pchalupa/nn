import { Link, Outlet, createRootRoute } from "@tanstack/react-router";
import { Skeleton } from "../components/Skeleton";
import { useStore } from "../store";

const Stats = () => {
	const data = useStore((store) => store.tickets);

	return (
		<div className="flex flex-col gap-y-2">
			<h3 className="text-lg">Stats</h3>
			<p className="flex flex-row gap-x-2">
				<span>Total Tickets:</span>
				<span>{data.length}</span>
			</p>
		</div>
	);
};

const RootComponent = () => (
	<div className="flex flex-row">
		<div className="min-h-screen bg-sky-100">
			<Link to="/">
				<h1 className="p-4 font-bold text-2xl">Kanban Board</h1>
			</Link>
			<hr className="border-sky-600" />
			<div className="px-4 py-2">
				<Link to="/backlog">Backlog</Link>
			</div>
			<Skeleton width="w-full" height="h-14">
				<Stats />
			</Skeleton>
		</div>
		<Outlet />
	</div>
);

export const Route = createRootRoute({
	component: RootComponent,
});
