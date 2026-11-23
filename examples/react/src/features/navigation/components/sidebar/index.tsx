import { Flex } from "@radix-ui/themes";

import { SidebarContent } from "./parts/sidebar-content";

/** Renders the desktop sidebar with board filters, labels and the account row; hidden below `md`. */
export const Sidebar = () => (
	<Flex
		asChild
		display={{ initial: "none", md: "flex" }}
		direction="column"
		gap="1"
		py="3"
		px="2"
		width="240px"
		flexShrink="0"
		overflowY="auto"
		style={{ background: "var(--color-panel)", borderRight: "1px solid var(--gray-a6)" }}
	>
		<aside>
			<SidebarContent size="1" />
		</aside>
	</Flex>
);
