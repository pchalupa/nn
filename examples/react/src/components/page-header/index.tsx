import { Flex, Heading, Text } from "@radix-ui/themes";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

interface PageHeaderProps {
	icon: ReactNode;
	title: string;
	count?: number;
	children?: ReactNode;
}

/** Renders the 52px desktop page header, hidden below `md`, with title, ticket count and trailing actions. */
export const PageHeader = ({ icon, title, count, children }: PageHeaderProps) => {
	const { t } = useTranslation();

	return (
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
				{count !== undefined && (
					<Text size="1" color="gray">
						{t("ticketCount", { count })}
					</Text>
				)}
			</Flex>
			<Flex flexGrow="1" />
			{children}
		</Flex>
	);
};
