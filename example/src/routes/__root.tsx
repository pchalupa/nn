import { Link, Outlet, createRootRoute } from "@tanstack/react-router";
import { Divider } from "../components/Divider";
import { Skeleton } from "../components/Skeleton";
import { useStore } from "../store";

const RootComponent = () => (
	<div className="flex flex-row bg-zinc-900">
		<SideBar />
		<Outlet />
	</div>
);

const SideBar = () => (
	<div className="min-h-screen w-1/4 min-w-28 max-w-32 bg-zinc-800">
		<Link to="/">
			<h1 className="p-4 text-center font-bold text-xl text-zinc-200">DBug</h1>
		</Link>
		<Skeleton width="w-3/4" height="h-6" className="mx-2">
			<Stats />
		</Skeleton>
		<Divider />
		<Navigation />
	</div>
);

const Stats = () => {
	const data = useStore((store) => store.tickets);

	return <p className="text-center text-zinc-600">Tickets: {data.length}</p>;
};

const Navigation = () => (
	<div className="flex flex-col gap-y-2 px-4 py-2">
		<Link to="/" className="text-zinc-400">
			Board
		</Link>
		<Link to="/backlog" className="text-zinc-400">
			Backlog
		</Link>
	</div>
);

export const Route = createRootRoute({
	component: RootComponent,
});
