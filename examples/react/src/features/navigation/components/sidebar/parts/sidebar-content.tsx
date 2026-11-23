import { KanbanIcon, TrayIcon } from "@phosphor-icons/react";
import { Box, Flex } from "@radix-ui/themes";
import { useMatch } from "@tanstack/react-router";
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

/** Renders the brand, board filters, labels and the account row shared by the sidebar and the drawer. */
export const SidebarContent = ({ size, onNavigate }: SidebarContentProps) => {
	const { t } = useTranslation();
	const ticketCount = useQuery((data) => data.tickets.length);
	const { id: userId } = useUser();
	const assignedCount = useQuery((data) => data.tickets.filter((ticket) => ticket.assignee === userId).length);
	const labels = useQuery((data) => [...new Set(data.tickets.flatMap((ticket) => ticket.labels))]);
	const board = useMatch({ from: "/_app/_board", shouldThrow: false });
	const search = board?.search;
	const boardActive = search !== undefined && search.assignee === undefined && search.label === undefined;
	const assignedActive = search?.assignee === "me";

	return (
		<>
			<Box p="2" pb="4">
				<Brand size="1" />
			</Box>
			<Flex asChild direction="column" gap="1">
				<nav aria-label={t("navigation")}>
					<NavItem
						size={size}
						icon={<KanbanIcon size={16} />}
						label={t("board")}
						count={ticketCount}
						active={boardActive}
						to="/"
						onClick={onNavigate}
					/>
					<NavItem
						size={size}
						icon={<TrayIcon size={16} />}
						label={t("assignedToMe")}
						count={assignedCount}
						active={assignedActive}
						to="/"
						search={{ assignee: "me" }}
						onClick={onNavigate}
					/>
					{labels.length > 0 && (
						<NavSection title={t("labels")}>
							{labels.map((name) => (
								<NavItem
									key={name}
									size={size}
									icon={<LabelDot name={name} />}
									label={name}
									active={search?.label === name}
									to="/"
									search={{ label: name }}
									onClick={onNavigate}
								/>
							))}
						</NavSection>
					)}
				</nav>
			</Flex>
			<Box flexGrow="1" />
			<AccountRow onNavigate={onNavigate} />
		</>
	);
};
