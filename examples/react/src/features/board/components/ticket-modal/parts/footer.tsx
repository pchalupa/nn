import { CheckIcon } from "@phosphor-icons/react";
import { Button, Dialog, Grid, Text } from "@radix-ui/themes";
import { useTranslation } from "react-i18next";

import { DeleteTicket } from "./delete-ticket";

interface TicketFooterProps {
	onDelete?: () => void;
}

/** Renders the modal footer, two equal 48px actions below `md`: Delete and Close for a saved ticket, Cancel and Create ticket for a new one. */
export const TicketFooter = ({ onDelete }: TicketFooterProps) => {
	const { t } = useTranslation();
	let justify: "between" | "end" = "end";
	let closeLabel = t("cancel");

	if (onDelete) {
		justify = "between";
		closeLabel = t("close");
	}

	return (
		<Grid
			columns={{ initial: "2", md: "auto auto" }}
			justify={justify}
			align="center"
			gap="2"
			py="3"
			px="4"
			flexShrink="0"
			className="ticket-footer"
		>
			{onDelete && <DeleteTicket onConfirm={onDelete} />}
			<Dialog.Close>
				<Button type="button" size={{ initial: "4", md: "2" }} variant="soft" color="gray">
					<Text size="2">{closeLabel}</Text>
				</Button>
			</Dialog.Close>
			{!onDelete && (
				<Button type="submit" size={{ initial: "4", md: "2" }}>
					<CheckIcon size={16} />
					<Text size="2">{t("createTicket")}</Text>
				</Button>
			)}
		</Grid>
	);
};
