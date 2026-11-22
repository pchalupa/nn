import { Flex } from "@radix-ui/themes";
import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

import { Sidebar } from "../components/sidebar";
import { authenticated } from "../modules/authentication/session";

const AppLayout = () => (
	<Flex flexGrow="1" minWidth="0">
		<Sidebar />
		<Flex asChild direction="column" flexGrow="1" minWidth="0" minHeight="0">
			<main>
				<Outlet />
			</main>
		</Flex>
	</Flex>
);

export const Route = createFileRoute("/_app")({
	beforeLoad: () => {
		if (!authenticated()) throw redirect({ to: "/sign-in" });
	},
	component: AppLayout,
});
