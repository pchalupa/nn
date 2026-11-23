import { Flex, Heading, Text } from "@radix-ui/themes";
import type { ReactNode } from "react";

interface MobileHeaderProps {
	action: ReactNode;
	title: string;
	subtitle?: string;
	as?: "h1" | "span";
	children?: ReactNode;
}

/** Renders the 56px mobile header, hidden from `md` up: a leading button, the title over an optional subtitle, and trailing actions. */
export const MobileHeader = ({ action, title, subtitle, as = "h1", children }: MobileHeaderProps) => {
	let heading = (
		<Text size="6" weight="bold" truncate>
			{title}
		</Text>
	);

	if (as === "h1") {
		heading = (
			<Heading as="h1" size="6" truncate>
				{title}
			</Heading>
		);
	}

	return (
		<Flex
			display={{ initial: "flex", md: "none" }}
			align="center"
			gap="3"
			px="4"
			height="56px"
			flexShrink="0"
			style={{ background: "var(--color-panel)", borderBottom: "1px solid var(--gray-a6)" }}
		>
			{action}
			<Flex direction="column" flexGrow="1" minWidth="0">
				{heading}
				{subtitle !== undefined && (
					<Text size="1" color="gray" truncate>
						{subtitle}
					</Text>
				)}
			</Flex>
			{children}
		</Flex>
	);
};
