import { ArrowSquareOutIcon, DotsThreeIcon, LinkIcon, PencilSimpleIcon, TrashIcon } from "@phosphor-icons/react";
import { DropdownMenu, IconButton } from "@radix-ui/themes";
import { Link } from "@tanstack/react-router";
import type { Board } from "example-schema";
import { useTranslation } from "react-i18next";

interface BoardMenuProps {
	board: Pick<Board, "id" | "name" | "description">;
	onRename: () => void;
	onDelete: () => void;
}

/** Renders the board card's actions menu: Open in new tab, Rename, Copy link and Delete. */
export const BoardMenu = ({ board, onRename, onDelete }: BoardMenuProps) => {
	const { t } = useTranslation();

	const handleCopyLink = () => navigator.clipboard.writeText(new URL(`/boards/${board.id}`, location.origin).href);

	return (
		<DropdownMenu.Root>
			<DropdownMenu.Trigger>
				<IconButton
					type="button"
					size="1"
					variant="ghost"
					color="gray"
					className="board-card-menu"
					aria-label={t("boardActions", { name: board.name })}
				>
					<DotsThreeIcon size={16} />
				</IconButton>
			</DropdownMenu.Trigger>
			<DropdownMenu.Content align="end" style={{ width: 200 }}>
				<DropdownMenu.Item asChild>
					<Link to="/boards/$boardId" params={{ boardId: board.id }} target="_blank" rel="noreferrer">
						<ArrowSquareOutIcon size={14} />
						{t("openInNewTab")}
					</Link>
				</DropdownMenu.Item>
				<DropdownMenu.Item onSelect={onRename}>
					<PencilSimpleIcon size={14} />
					{t("rename")}
				</DropdownMenu.Item>
				<DropdownMenu.Item onSelect={handleCopyLink}>
					<LinkIcon size={14} />
					{t("copyLink")}
				</DropdownMenu.Item>
				<DropdownMenu.Separator />
				<DropdownMenu.Item color="red" onSelect={onDelete}>
					<TrashIcon size={14} />
					{t("delete")}
				</DropdownMenu.Item>
			</DropdownMenu.Content>
		</DropdownMenu.Root>
	);
};
