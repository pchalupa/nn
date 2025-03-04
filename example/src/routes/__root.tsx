import { Link, Outlet, createRootRoute } from "@tanstack/react-router";
import { useStore } from "../store";

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

const RootComponent = () => (
	<div className="flex flex-row">
		<div className="min-h-screen bg-sky-100">
			<Link to="/">
				<h1 className="p-4 font-bold text-2xl">Kanban Board</h1>
			</Link>
			<Stats />
			<Link to="/backlog">Backlog</Link>
		</div>
		<Outlet />
	</div>
);

export const Route = createRootRoute({
	component: RootComponent,
});
