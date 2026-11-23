import { TrashIcon } from "@phosphor-icons/react";
import { AlertDialog, Button, Flex } from "@radix-ui/themes";
import { useTranslation } from "react-i18next";

interface DeleteTicketProps {
	onConfirm: () => void;
}

/** Renders the Delete button that deletes the ticket after a confirmation. */
export const DeleteTicket = ({ onConfirm }: DeleteTicketProps) => {
	const { t } = useTranslation();

	return (
		<AlertDialog.Root>
			<AlertDialog.Trigger>
				<Button type="button" color="red">
					<TrashIcon size={16} />
					{t("delete")}
				</Button>
			</AlertDialog.Trigger>
			<AlertDialog.Content maxWidth="400px">
				<AlertDialog.Title>{t("deleteTicketTitle")}</AlertDialog.Title>
				<AlertDialog.Description size="3" color="gray">
					{t("deleteTicketBody")}
				</AlertDialog.Description>
				<Flex justify="end" gap="3" mt="4">
					<AlertDialog.Cancel>
						<Button type="button" variant="soft" color="gray">
							{t("cancel")}
						</Button>
					</AlertDialog.Cancel>
					<AlertDialog.Action>
						<Button type="button" color="red" onClick={onConfirm}>
							{t("delete")}
						</Button>
					</AlertDialog.Action>
				</Flex>
			</AlertDialog.Content>
		</AlertDialog.Root>
	);
};
