import { ListIcon, PlusIcon, SquaresFourIcon } from "@phosphor-icons/react";
import { Box, Button, Grid, Text } from "@radix-ui/themes";
import { useRef } from "react";
import { useTranslation } from "react-i18next";

import { ActionBar } from "@/components/action-bar";
import { MobileHeader } from "@/components/mobile-header";
import { HeaderButton } from "@/components/mobile-header/parts/header-button";
import { PageHeader } from "@/components/page-header";
import { BoardCard } from "@/features/boards/components/board-card";
import { BoardDialog, type BoardDialogHandle } from "@/features/boards/components/board-dialog";
import { Drawer, type DrawerHandle } from "@/features/navigation/components/drawer";
import { useQuery } from "@/store";

/** Renders the boards list: a card per board in a three-column grid, one column below `md`, and New board. */
export const BoardsPage = () => {
	const { t } = useTranslation();
	const boards = useQuery((data) => data.boards.map(({ id, name, description }) => ({ id, name, description })));
	const drawer = useRef<DrawerHandle>(null);
	const boardDialog = useRef<BoardDialogHandle>(null);
	const subtitle = t("boardCount", { count: boards.length });

	const handleOpenMenu = () => drawer.current?.open();

	const handleNewBoard = () => boardDialog.current?.open();

	return (
		<>
			<MobileHeader
				action={
					<HeaderButton label={t("openMenu")} onClick={handleOpenMenu}>
						<ListIcon size={20} />
					</HeaderButton>
				}
				title={t("boards")}
				subtitle={subtitle}
			/>
			<PageHeader icon={<SquaresFourIcon size={16} color="var(--gray-a11)" />} title={t("boards")} subtitle={subtitle}>
				<Button type="button" aria-label={t("newBoard")} onClick={handleNewBoard}>
					<PlusIcon size={16} />
					{t("newShort")}
				</Button>
			</PageHeader>
			<Box p={{ initial: "4", md: "0" }} px={{ md: "8" }} py={{ md: "7" }} flexGrow="1" minHeight="0" overflowY="auto">
				<Grid columns={{ initial: "1", md: "3" }} gap={{ initial: "3", md: "4" }}>
					{boards.map((board) => (
						<BoardCard key={board.id} board={board} />
					))}
				</Grid>
			</Box>
			<ActionBar>
				<Button type="button" size="4" aria-label={t("newBoard")} onClick={handleNewBoard}>
					<PlusIcon size={16} />
					<Text size="2">{t("newBoard")}</Text>
				</Button>
			</ActionBar>
			<BoardDialog ref={boardDialog} />
			<Drawer ref={drawer} />
		</>
	);
};
