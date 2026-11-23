import { Dialog, Flex, VisuallyHidden } from "@radix-ui/themes";
import { useTranslation } from "react-i18next";

import { SidebarContent } from "../sidebar/sidebar-content";

interface DrawerProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

/** Shows the sidebar content in a 300px left sheet over a scrim, closing when a link navigates. */
export const Drawer = ({ open, onOpenChange }: DrawerProps) => {
	const { t } = useTranslation();

	const handleNavigate = () => onOpenChange(false);

	return (
		<Dialog.Root open={open} onOpenChange={onOpenChange}>
			<Dialog.Content
				aria-describedby={undefined}
				width="300px"
				height="100dvh"
				style={{
					position: "fixed",
					top: 0,
					left: 0,
					margin: 0,
					padding: 0,
					borderRadius: 0,
					borderRight: "1px solid var(--gray-a6)",
				}}
			>
				<VisuallyHidden>
					<Dialog.Title>{t("menu")}</Dialog.Title>
				</VisuallyHidden>
				<Flex direction="column" gap="1" py="3" px="2" minHeight="100%">
					<SidebarContent size="2" onNavigate={handleNavigate} />
				</Flex>
			</Dialog.Content>
		</Dialog.Root>
	);
};
