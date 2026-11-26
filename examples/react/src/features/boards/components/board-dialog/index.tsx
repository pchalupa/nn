import { Dialog } from "@radix-ui/themes";
import type { Board } from "example-schema";
import { type Ref, useImperativeHandle, useState } from "react";
import { useTranslation } from "react-i18next";

import { BoardForm } from "./parts/board-form";

/** Controls a board dialog from its parent. */
export interface BoardDialogHandle {
	/** Opens the dialog. */
	open: () => void;
}

interface BoardDialogProps {
	ref?: Ref<BoardDialogHandle>;
	board?: Pick<Board, "id" | "name" | "description">;
}

/** Shows the New board dialog, or the Rename board dialog for `board`, as a bottom sheet below `md`, once `open` is called through `ref`. */
export const BoardDialog = ({ ref, board }: BoardDialogProps) => {
	const { t } = useTranslation();
	const [open, setOpen] = useState(false);
	let title = t("newBoard");

	if (board) title = t("renameBoard");

	useImperativeHandle(ref, () => ({ open: () => setOpen(true) }), []);

	const handleDone = () => setOpen(false);

	return (
		<Dialog.Root open={open} onOpenChange={setOpen}>
			<Dialog.Content maxWidth="440px" className="sheet-dialog">
				<Dialog.Title size="5" mb="2">
					{title}
				</Dialog.Title>
				<Dialog.Description size="2" color="gray">
					{t("newBoardBody")}
				</Dialog.Description>
				<BoardForm board={board} onDone={handleDone} />
			</Dialog.Content>
		</Dialog.Root>
	);
};
