import { Flex } from "@radix-ui/themes";
import { createRootRoute, Outlet } from "@tanstack/react-router";

import { useLanguageSync } from "@/features/language/use-language-sync";

const RootComponent = () => {
	useLanguageSync();

	return (
		<Flex height="100dvh">
			<Outlet />
		</Flex>
	);
};

export const Route = createRootRoute({
	component: RootComponent,
});
