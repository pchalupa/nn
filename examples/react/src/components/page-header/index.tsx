import { Flex, Heading, Text } from "@radix-ui/themes";
import type { ReactNode } from "react";

interface PageHeaderProps {
	icon: ReactNode;
	title: string;
	subtitle?: string;
	children?: ReactNode;
}

/** Renders the 52px desktop page header, hidden below `md`, with title, subtitle and trailing actions. */
export const PageHeader = ({ icon, title, subtitle, children }: PageHeaderProps) => (
	<Flex
		display={{ initial: "none", md: "flex" }}
		align="center"
		gap="3"
		px="4"
		height="52px"
		flexShrink="0"
		style={{ background: "var(--color-panel)", borderBottom: "1px solid var(--gray-a6)" }}
	>
		<Flex align="center" gap="2">
			{icon}
			<Heading size="2">{title}</Heading>
			{subtitle !== undefined && (
				<Text size="1" color="gray">
					{subtitle}
				</Text>
			)}
		</Flex>
		<Flex flexGrow="1" />
		{children}
	</Flex>
);
