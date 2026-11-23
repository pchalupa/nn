import { ArrowLeftIcon, LinkIcon } from "@phosphor-icons/react";
import { Dialog } from "@radix-ui/themes";
import { useTranslation } from "react-i18next";

import { MobileHeader } from "@/components/mobile-header";
import { HeaderButton } from "@/components/mobile-header/parts/header-button";

interface MobileTicketHeaderProps {
	ticketKey?: string;
}

/** Renders the full-screen ticket header: Back, the key over the board name, and Copy link for a saved ticket. */
export const MobileTicketHeader = ({ ticketKey }: MobileTicketHeaderProps) => {
	const { t } = useTranslation();

	const handleCopyLink = () => navigator.clipboard.writeText(location.href);

	return (
		<MobileHeader
			as="span"
			action={
				<Dialog.Close>
					<HeaderButton label={t("back")}>
						<ArrowLeftIcon size={20} />
					</HeaderButton>
				</Dialog.Close>
			}
			title={ticketKey ?? t("newTicket")}
			subtitle="nn"
		>
			{ticketKey !== undefined && (
				<HeaderButton label={t("copyLink")} onClick={handleCopyLink}>
					<LinkIcon size={20} />
				</HeaderButton>
			)}
		</MobileHeader>
	);
};
