import { Box, Dialog, Flex, Separator, VisuallyHidden } from "@radix-ui/themes";
import { useHotkey } from "@tanstack/react-hotkeys";
import { type ReactNode, type SubmitEvent, useState } from "react";

import { TicketFooter } from "./footer";
import { TicketHeader } from "./header";
import { MobileTicketHeader } from "./mobile-ticket-header";

interface TicketDialogShellProps {
	title: string;
	ticketKey?: string;
	onSubmit: (event: SubmitEvent<HTMLFormElement>) => void;
	onClose: () => void;
	onDelete?: () => void;
	children: ReactNode;
}

/** Frames the ticket form in a dialog, full-screen below `md`, with the headers and footer, submitting on Mod+Enter. */
export const TicketDialogShell = ({
	title,
	ticketKey,
	onSubmit,
	onClose,
	onDelete,
	children,
}: TicketDialogShellProps) => {
	const [form, setForm] = useState<HTMLFormElement | null>(null);

	const handleOpenChange = (open: boolean) => {
		if (!open) onClose();
	};

	const handleSubmitShortcut = () => form?.requestSubmit();

	useHotkey("Mod+Enter", handleSubmitShortcut, { target: form });

	return (
		<Dialog.Root open onOpenChange={handleOpenChange}>
			<Dialog.Content
				align="center"
				width={{ initial: "100vw", md: "100%" }}
				maxWidth={{ initial: "100vw", md: "920px" }}
				height={{ initial: "100dvh", md: "auto" }}
				aria-describedby={undefined}
				className="ticket-dialog"
			>
				<VisuallyHidden>
					<Dialog.Title>{title}</Dialog.Title>
				</VisuallyHidden>
				<Flex asChild direction="column" height="100%">
					<form ref={setForm} noValidate onSubmit={onSubmit}>
						<MobileTicketHeader ticketKey={ticketKey} />
						<Box display={{ initial: "none", md: "block" }}>
							<TicketHeader ticketKey={ticketKey} />
							<Separator size="4" color="gray" />
						</Box>
						{children}
						<Separator size="4" color="gray" />
						<TicketFooter onDelete={onDelete} />
					</form>
				</Flex>
			</Dialog.Content>
		</Dialog.Root>
	);
};
