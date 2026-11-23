import { XIcon } from "@phosphor-icons/react";
import { Flex, IconButton, Text } from "@radix-ui/themes";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

interface FilterChipProps {
	icon: ReactNode;
	name: string;
	value: string;
	onClear: () => void;
}

/** Renders an active board filter as a chip with a clear button. */
export const FilterChip = ({ icon, name, value, onClear }: FilterChipProps) => {
	const { t } = useTranslation();

	return (
		<Flex
			align="center"
			gap="1"
			pl="2"
			pr="1"
			height="32px"
			flexShrink="0"
			style={{
				background: "var(--gray-surface)",
				boxShadow: "inset 0 0 0 1px var(--gray-a7)",
				borderRadius: "var(--radius-1)",
			}}
		>
			{icon}
			<Text size="1" color="gray">
				{name}
			</Text>
			<Text size="1" weight="medium">
				{value}
			</Text>
			<IconButton
				type="button"
				size="1"
				variant="ghost"
				color="gray"
				aria-label={t("clearFilter", { name, value })}
				onClick={onClear}
			>
				<XIcon size={12} />
			</IconButton>
		</Flex>
	);
};
