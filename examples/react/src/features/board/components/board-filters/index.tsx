import { FunnelIcon, TagIcon, UserIcon } from "@phosphor-icons/react";
import { Button, Flex } from "@radix-ui/themes";
import { useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

import { FilterChip } from "@/components/filter-chip";
import { type BoardSearch, withoutFilter } from "@/features/board/board-search";

interface BoardFiltersProps {
	boardId: string;
	search: BoardSearch;
	onOpenFilters: () => void;
}

/** Renders the mobile filters row, hidden from `md` up: a chip per active board filter and the Filter button. */
export const BoardFilters = ({ boardId, search, onOpenFilters }: BoardFiltersProps) => {
	const { t } = useTranslation();
	const navigate = useNavigate();

	const clear = (filter: keyof BoardSearch) =>
		navigate({ to: "/boards/$boardId", params: { boardId }, search: withoutFilter(search, filter) });

	return (
		<Flex display={{ initial: "flex", md: "none" }} align="center" gap="2" wrap="wrap">
			{search.assignee === "me" && (
				<FilterChip
					icon={<UserIcon size={14} color="var(--gray-a11)" />}
					name={t("assignee")}
					value={t("me")}
					onClear={() => clear("assignee")}
				/>
			)}
			{search.label !== undefined && (
				<FilterChip
					icon={<TagIcon size={14} color="var(--gray-a11)" />}
					name={t("label")}
					value={search.label}
					onClear={() => clear("label")}
				/>
			)}
			<Button type="button" size="2" variant="ghost" color="gray" ml="2" onClick={onOpenFilters}>
				<FunnelIcon size={16} />
				{t("filter")}
			</Button>
		</Flex>
	);
};
