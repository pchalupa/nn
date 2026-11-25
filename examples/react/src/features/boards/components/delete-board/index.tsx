import { TrashIcon } from "@phosphor-icons/react";
import { AlertDialog, Button, Flex } from "@radix-ui/themes";
import { useTranslation } from "react-i18next";

interface DeleteBoardProps {
	name: string;
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onConfirm: () => void;
}

/** Asks to confirm deleting a board and its tickets. */
export const DeleteBoard = ({ name, open, onOpenChange, onConfirm }: DeleteBoardProps) => {
	const { t } = useTranslation();

	return (
		<AlertDialog.Root open={open} onOpenChange={onOpenChange}>
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
