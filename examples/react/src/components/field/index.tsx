import { Flex, Text } from "@radix-ui/themes";
import type { ReactNode } from "react";

interface FieldProps {
	label: string;
	children: ReactNode;
}

export const Field = ({ label, children }: FieldProps) => (
	<Text as="label" size="1" weight="medium" color="gray">
		<Flex direction="column" gap="1">
			{label}
			{children}
		</Flex>
	</Text>
);
