import { Flex } from "@radix-ui/themes";
import { createRootRoute, Outlet } from "@tanstack/react-router";

const RootComponent = () => (
	<Flex minHeight="100vh">
		<Outlet />
	</Flex>
);

export const Route = createRootRoute({
	component: RootComponent,
});
