import { KanbanIcon, ListIcon, PlusIcon } from "@phosphor-icons/react";
import { Box, Button, Flex, Text } from "@radix-ui/themes";
import type { Status as TicketStatus } from "example-schema";
import { useRef } from "react";
import { useTranslation } from "react-i18next";

import { ActionBar } from "@/components/action-bar";
import { MobileHeader } from "@/components/mobile-header";
import { HeaderButton } from "@/components/mobile-header/parts/header-button";
import { PageHeader } from "@/components/page-header";
import { useUser } from "@/features/authentication/authentication";
import { type BoardSearch, matchesBoardSearch } from "@/features/board/board-search";
import { BoardFilters } from "@/features/board/components/board-filters";
import { BoardGrid } from "@/features/board/components/board/parts/board-grid";
import { Drawer, type DrawerHandle } from "@/features/navigation/components/drawer";
import { useQuery } from "@/store";

interface BoardProps {
	boardId: string;
	search: BoardSearch;
	onNewTicket: (status: TicketStatus) => void;
}

/** Renders one board: four status columns, scrolling sideways below `md` between the filters row and the New action bar. */
export const Board = ({ boardId, search, onNewTicket }: BoardProps) => {
	const { t } = useTranslation();
	const { id: userId } = useUser();
	const name = useQuery((data) => data.boards.find((board) => board.id === boardId)?.name ?? "");
	const count = useQuery(
		(data) =>
			data.boards
				.find((board) => board.id === boardId)
				?.tickets.filter((ticket) => matchesBoardSearch(ticket, search, userId)).length ?? 0,
	);
	const drawer = useRef<DrawerHandle>(null);

	const handleOpenMenu = () => drawer.current?.open();

	const handleNewTicket = () => onNewTicket("backlog");

	return (
		<>
			<MobileHeader
				action={
					<HeaderButton label={t("openMenu")} onClick={handleOpenMenu}>
						<ListIcon size={20} />
					</HeaderButton>
				}
				title={name}
				subtitle={t("ticketCount", { count })}
			/>
			<PageHeader
				icon={<KanbanIcon size={16} color="var(--gray-a11)" />}
				title={name}
				subtitle={t("ticketCount", { count })}
			>
				<Button type="button" aria-label={t("newTicket")} onClick={handleNewTicket}>
					<PlusIcon size={16} />
					{t("newShort")}
				</Button>
			</PageHeader>
			<Flex direction="column" gap="4" py="4" px={{ initial: "0", md: "4" }} flexGrow="1" minHeight="0">
				<Box px={{ initial: "4", md: "0" }}>
					<BoardFilters boardId={boardId} search={search} onOpenFilters={handleOpenMenu} />
				</Box>
				<BoardGrid boardId={boardId} search={search} />
			</Flex>
			<ActionBar>
				<Button type="button" size="4" aria-label={t("newTicket")} onClick={handleNewTicket}>
					<PlusIcon size={16} />
					<Text size="2">{t("newShort")}</Text>
				</Button>
			</ActionBar>
			<Drawer ref={drawer} />
		</>
	);
};
