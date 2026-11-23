import { KanbanIcon } from "@phosphor-icons/react";
import { Avatar, Flex, type FlexProps, Text } from "@radix-ui/themes";

const iconSizes = { "1": 14, "2": 18 } as const;

const nameSizes = { "1": "2", "2": "4" } as const;

interface BrandProps {
	size: "1" | "2";
	nameDisplay?: FlexProps["display"];
}

/** Renders the accent brand mark followed by the board name, which `nameDisplay` can hide per breakpoint. */
export const Brand = ({ size, nameDisplay }: BrandProps) => (
	<Flex align="center" gap="2">
		<Avatar size={size} variant="solid" radius="large" fallback={<KanbanIcon size={iconSizes[size]} />} />
		<Flex display={nameDisplay}>
			<Text size={nameSizes[size]} weight="bold">
				Board
			</Text>
		</Flex>
	</Flex>
);
