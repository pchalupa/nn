import { Flex, Heading, Text } from "@radix-ui/themes";

interface TicketProps {
	title: string;
	description: string;
	assignee?: string;
}

export const Ticket = ({ title, description, assignee }: TicketProps) => (
	<Flex direction="column" gap="2">
		<Heading as="h4" size="3" weight="medium">
			{title}
		</Heading>
		<Text as="p" size="2" color="gray">
			{description}
		</Text>
		<Text as="p" size="1" weight="medium" color="gray" highContrast>
			{assignee}
		</Text>
	</Flex>
);
