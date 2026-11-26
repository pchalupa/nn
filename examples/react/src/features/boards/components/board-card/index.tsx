import { Box, Card, Flex, Heading, Text } from "@radix-ui/themes";
import { Link } from "@tanstack/react-router";
import { useRef } from "react";
import { useTranslation } from "react-i18next";

import type { BoardDetails } from "@/features/boards/board-details";
import { boardProgress } from "@/features/boards/board-progress";
import { BoardDialog, type BoardDialogHandle } from "@/features/boards/components/board-dialog";
import { BoardMark } from "@/features/boards/components/board-mark";
import { DeleteBoard, type DeleteBoardHandle } from "@/features/boards/components/delete-board";
import { useMutation, useQuery } from "@/store";

import { BoardMenu } from "./parts/board-menu";
import { ProgressBar } from "./parts/progress-bar";

interface BoardCardProps {
	board: BoardDetails;
}

/** Renders a board's card, linking to the board, with its progress and an actions menu. */
export const BoardCard = ({ board }: BoardCardProps) => {
	const { t } = useTranslation();
	const mutate = useMutation();
	const progress = useQuery((data) => boardProgress(data.boards.find((entry) => entry.id === board.id)?.tickets ?? []));
	const renameDialog = useRef<BoardDialogHandle>(null);
	const deleteDialog = useRef<DeleteBoardHandle>(null);

	const handleRename = () => renameDialog.current?.open();

	const handleDelete = () => deleteDialog.current?.open();

	const handleConfirmDelete = () =>
		mutate((data) => {
			data.boards = data.boards.filter((entry) => entry.id !== board.id);
		});

	return (
		<Card size="2" className="board-card">
			<Flex direction="column" gap="3" height="100%">
				<Flex align="center" gap="3">
					<BoardMark />
					<Heading as="h2" size="3" truncate style={{ flexGrow: 1 }}>
						<Link to="/boards/$boardId" params={{ boardId: board.id }} className="board-card-link">
							{board.name}
						</Link>
					</Heading>
					<BoardMenu board={board} onRename={handleRename} onDelete={handleDelete} />
				</Flex>
				{board.description !== "" && (
					<Text size="2" color="gray" className="board-card-description">
						{board.description}
					</Text>
				)}
				<Box flexGrow="1" />
				<Flex direction="column" gap="2">
					<Flex justify="between" gap="2">
						<Text size="1" color="gray">
							{t("ticketCount", { count: progress.total })}
						</Text>
						<Text size="1" color="gray">
							{t("percentDone", { percent: progress.percent })}
						</Text>
					</Flex>
					<ProgressBar counts={progress.counts} />
				</Flex>
			</Flex>
			<BoardDialog ref={renameDialog} board={board} />
			<DeleteBoard ref={deleteDialog} name={board.name} onConfirm={handleConfirmDelete} />
		</Card>
	);
};
