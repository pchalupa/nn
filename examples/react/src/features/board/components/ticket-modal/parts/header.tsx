import { CaretRightIcon, KanbanIcon, LinkIcon, XIcon } from "@phosphor-icons/react";
import { Button, Dialog, Flex, IconButton, Text } from "@radix-ui/themes";
import { useTranslation } from "react-i18next";

import { boardName } from "@/features/board/board-name";

interface TicketHeaderProps {
	ticketKey?: string;
}

/** Renders the modal header: the breadcrumb, Copy link for a saved ticket, and close. */
export const TicketHeader = ({ ticketKey }: TicketHeaderProps) => {
	const { t } = useTranslation();

	const handleCopyLink = () => navigator.clipboard.writeText(location.href);

	return (
		<Flex align="center" gap="2" height="52px" pl="4" pr="3">
			<KanbanIcon size={16} color="var(--gray-a11)" />
			<Text size="2" weight="medium" color="gray">
				{boardName}
			</Text>
			{ticketKey !== undefined && (
				<>
					<CaretRightIcon size={14} color="var(--gray-a11)" />
					<Text size="1">{ticketKey}</Text>
				</>
			)}
			<Flex flexGrow="1" />
			{ticketKey !== undefined && (
				<Button type="button" size="1" variant="ghost" color="gray" onClick={handleCopyLink}>
					<LinkIcon size={16} />
					{t("copyLink")}
				</Button>
			)}
			<Dialog.Close>
				<IconButton type="button" size="1" variant="ghost" color="gray" aria-label={t("closeTicket")}>
					<XIcon size={16} />
				</IconButton>
			</Dialog.Close>
		</Flex>
	);
};
