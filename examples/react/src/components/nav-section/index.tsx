import { Flex } from "@radix-ui/themes";
import type { ReactNode } from "react";

import { Caption } from "@/components/caption";

interface NavSectionProps {
	title: string;
	children: ReactNode;
}

/** Groups nav items under an uppercase caption, 4px apart like the nav list. */
export const NavSection = ({ title, children }: NavSectionProps) => (
	<Flex direction="column" gap="1">
		<Flex pt="4" px="2" pb="1">
			<Caption>{title}</Caption>
		</Flex>
		{children}
	</Flex>
);
