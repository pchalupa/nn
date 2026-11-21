import { createRootRoute, Outlet } from "@tanstack/react-router";

const RootComponent = () => (
	<div className="flex flex-row bg-zinc-900">
		<Outlet />
	</div>
);

export const Route = createRootRoute({
	component: RootComponent,
});
