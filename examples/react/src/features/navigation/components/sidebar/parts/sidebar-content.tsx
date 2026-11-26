import { KanbanIcon, SquaresFourIcon, TrayIcon } from "@phosphor-icons/react";
import { Box, Flex, Link as ThemeLink } from "@radix-ui/themes";
import { Link, useMatch } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

import { Brand } from "@/components/brand";
import { NavItem, type NavItemSize } from "@/components/nav-item";
import { NavSection } from "@/components/nav-section";
import { useUser } from "@/features/authentication/authentication";
import { useQuery } from "@/store";

import { AccountRow } from "./account-row";
import { LabelDot } from "./label-dot";

interface SidebarContentProps {
	size: NavItemSize;
	onNavigate?: () => void;
}

/** Renders the brand, the navigation for the current page and the account row shared by the sidebar and the drawer. */
export const SidebarContent = ({ size, onNavigate }: SidebarContentProps) => {
	const { t } = useTranslation();
	const { id: userId } = useUser();
	const onBoardsList = useMatch({ from: "/_app/", shouldThrow: false }) !== undefined;
	const match = useMatch({ from: "/_app/boards/$boardId", shouldThrow: false });
	const boardId = match?.params.boardId;
	const search = match?.search;
	const boardCount = useQuery((data) => data.boards.length);
	const board = useQuery((data) => {
		const entry = data.boards.find((item) => item.id === boardId);

		if (!entry) return undefined;

		return {
			id: entry.id,
			name: entry.name,
			ticketCount: entry.tickets.length,
			assignedCount: entry.tickets.filter((ticket) => ticket.assignee === userId).length,
			labels: [...new Set(entry.tickets.flatMap((ticket) => ticket.labels))],
		};
	});
	const boardActive = search !== undefined && search.assignee === undefined && search.label === undefined;
	const assignedActive = search?.assignee === "me";

	return (
		<>
			<Box p="2" pb="4">
				<ThemeLink asChild underline="none" color="gray" highContrast>
					<Link to="/" onClick={onNavigate}>
						<Brand size="1" />
					</Link>
				</ThemeLink>
			</Box>
			<Flex asChild direction="column" gap="1">
				<nav aria-label={t("navigation")}>
					{boardId === undefined && !onBoardsList && (
						<NavItem
							size={size}
							icon={<SquaresFourIcon size={16} />}
							label={t("boards")}
							count={boardCount}
							to="/"
							onClick={onNavigate}
						/>
					)}
					{board && (
						<>
							<NavItem
								size={size}
								icon={<KanbanIcon size={16} />}
								label={board.name}
								count={board.ticketCount}
								active={boardActive}
								to="/boards/$boardId"
								params={{ boardId: board.id }}
								onClick={onNavigate}
							/>
							<NavItem
								size={size}
								icon={<TrayIcon size={16} />}
								label={t("assignedToMe")}
								count={board.assignedCount}
								active={assignedActive}
								to="/boards/$boardId"
								params={{ boardId: board.id }}
								search={{ assignee: "me" }}
								onClick={onNavigate}
							/>
							{board.labels.length > 0 && (
								<NavSection title={t("labels")}>
									{board.labels.map((name) => (
										<NavItem
											key={name}
											size={size}
											icon={<LabelDot name={name} />}
											label={name}
											active={search?.label === name}
											to="/boards/$boardId"
											params={{ boardId: board.id }}
											search={{ label: name }}
											onClick={onNavigate}
										/>
									))}
								</NavSection>
							)}
						</>
					)}
				</nav>
			</Flex>
			<Box flexGrow="1" />
			<AccountRow onNavigate={onNavigate} />
		</>
	);
};
