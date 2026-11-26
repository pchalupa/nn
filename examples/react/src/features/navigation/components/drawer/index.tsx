import { Dialog, Flex } from "@radix-ui/themes";
import { type Ref, useImperativeHandle, useState } from "react";
import { useTranslation } from "react-i18next";

import { SidebarContent } from "@/features/navigation/components/sidebar/parts/sidebar-content";

/** Controls the drawer from its parent. */
export interface DrawerHandle {
	/** Opens the drawer. */
	open: () => void;
}

interface DrawerProps {
	ref?: Ref<DrawerHandle>;
}

/** Shows the sidebar content in a 300px left sheet over a scrim once `open` is called through `ref`, closing when a link navigates. */
export const Drawer = ({ ref }: DrawerProps) => {
	const { t } = useTranslation();
	const [open, setOpen] = useState(false);

	useImperativeHandle(ref, () => ({ open: () => setOpen(true) }), []);

	const handleNavigate = () => setOpen(false);

	return (
		<Dialog.Root open={open} onOpenChange={setOpen}>
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
				<Dialog.Title hidden>{t("menu")}</Dialog.Title>
				<Flex direction="column" gap="1" py="3" px="2" minHeight="100%">
					<SidebarContent size="2" onNavigate={handleNavigate} />
				</Flex>
			</Dialog.Content>
		</Dialog.Root>
	);
};
