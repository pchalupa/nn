import { KanbanIcon, ListIcon, PlusIcon } from "@phosphor-icons/react";
import { Box, Button, Flex, Grid, Text } from "@radix-ui/themes";
import { type Status as TicketStatus, status } from "example-schema";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { ActionBar } from "@/components/action-bar";
import { MobileHeader } from "@/components/mobile-header";
import { HeaderButton } from "@/components/mobile-header/parts/header-button";
import { PageHeader } from "@/components/page-header";
import { useUser } from "@/features/authentication/authentication";
import { boardName } from "@/features/board/board-name";
import { type BoardSearch, matchesBoardSearch } from "@/features/board/board-search";
import { BoardFilters } from "@/features/board/components/board-filters";
import { Column } from "@/features/board/components/column";
import { Drawer } from "@/features/navigation/components/drawer";
import { statusLabels } from "@/i18n";
import { useQuery } from "@/store";

interface BoardProps {
	search: BoardSearch;
	onNewTicket: (status: TicketStatus) => void;
}

/** Renders the board: four status columns, scrolling sideways below `md` between the filters row and the New action bar. */
export const Board = ({ search, onNewTicket }: BoardProps) => {
	const { t } = useTranslation();
	const { id: userId } = useUser();
	const count = useQuery((data) => data.tickets.filter((ticket) => matchesBoardSearch(ticket, search, userId)).length);
	const [menuOpen, setMenuOpen] = useState(false);

	const handleOpenMenu = () => setMenuOpen(true);

	const handleNewTicket = () => onNewTicket("todo");

	return (
		<>
			<MobileHeader
				action={
					<HeaderButton label={t("openMenu")} onClick={handleOpenMenu}>
						<ListIcon size={20} />
					</HeaderButton>
				}
				title={boardName}
				subtitle={t("ticketCount", { count })}
			/>
			<PageHeader icon={<KanbanIcon size={16} color="var(--gray-a11)" />} title={boardName} count={count}>
				<Button type="button" aria-label={t("newTicket")} onClick={handleNewTicket}>
					<PlusIcon size={16} />
					{t("newShort")}
				</Button>
			</PageHeader>
			<Flex direction="column" gap="4" py="4" px={{ initial: "0", md: "4" }} flexGrow="1" minHeight="0">
				<Box px={{ initial: "4", md: "0" }}>
					<BoardFilters search={search} onOpenFilters={handleOpenMenu} />
				</Box>
				<Grid
					columns={{ initial: "repeat(4, 300px)", md: "4" }}
					rows="1"
					gap={{ initial: "3", md: "4" }}
					px={{ initial: "4", md: "0" }}
					overflowX={{ initial: "auto", md: "visible" }}
					flexGrow="1"
					minHeight="0"
				>
					{status.literals.map((literal) => (
						<Column key={literal} title={t(statusLabels[literal])} status={literal} search={search} />
					))}
				</Grid>
			</Flex>
			<ActionBar>
				<Button type="button" size="4" aria-label={t("newTicket")} onClick={handleNewTicket}>
					<PlusIcon size={16} />
					<Text size="2">{t("newShort")}</Text>
				</Button>
			</ActionBar>
			<Drawer open={menuOpen} onOpenChange={setMenuOpen} />
		</>
	);
};
