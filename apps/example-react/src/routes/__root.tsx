import { createRootRoute, Outlet } from "@tanstack/react-router";

const RootComponent = () => (
	<div className="flex h-screen bg-canvas text-fg">
		<Outlet />
	</div>
);

export const Route = createRootRoute({
	component: RootComponent,
});
