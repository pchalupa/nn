import { TrashIcon } from "@phosphor-icons/react";
import { AlertDialog, Button, Flex } from "@radix-ui/themes";
import { type Ref, useImperativeHandle, useState } from "react";
import { useTranslation } from "react-i18next";

/** Controls the delete confirmation from its parent. */
export interface DeleteBoardHandle {
	/** Opens the confirmation. */
	open: () => void;
}

interface DeleteBoardProps {
	ref?: Ref<DeleteBoardHandle>;
	name: string;
	onConfirm: () => void;
}

/** Asks to confirm deleting a board and its tickets once `open` is called through `ref`. */
export const DeleteBoard = ({ ref, name, onConfirm }: DeleteBoardProps) => {
	const { t } = useTranslation();
	const [open, setOpen] = useState(false);

	useImperativeHandle(ref, () => ({ open: () => setOpen(true) }), []);

	return (
		<AlertDialog.Root open={open} onOpenChange={setOpen}>
			<AlertDialog.Content maxWidth="400px">
				<AlertDialog.Title>{t("deleteBoardTitle", { name })}</AlertDialog.Title>
				<AlertDialog.Description size="3" color="gray">
					{t("deleteBoardBody")}
				</AlertDialog.Description>
				<Flex justify="end" gap="3" mt="4">
					<AlertDialog.Cancel>
						<Button type="button" variant="soft" color="gray">
							{t("cancel")}
						</Button>
					</AlertDialog.Cancel>
					<AlertDialog.Action>
						<Button type="button" color="red" onClick={onConfirm}>
							<TrashIcon size={16} />
							{t("delete")}
						</Button>
					</AlertDialog.Action>
				</Flex>
			</AlertDialog.Content>
		</AlertDialog.Root>
	);
};
