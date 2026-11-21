import { Box, Button, Flex, Heading, Link, Separator, Text } from "@radix-ui/themes";
import { createFileRoute, Link as RouterLink, Outlet, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { LanguageSelector } from "../components/language-selector";
import { SignOut } from "../components/sign-out";
import { TicketModal } from "../components/ticket-modal";
import { authenticated } from "../modules/authentication/session";
import { useQuery } from "../store";

const Stats = () => {
	const { t } = useTranslation();
	const count = useQuery((data) => data.tickets.length);

	return (
		<Text as="p" size="2" color="gray" align="center">
			{t("tickets", { count })}
		</Text>
	);
};

const Navigation = () => {
	const { t } = useTranslation();

	return (
		<Flex direction="column" gap="2" px="4" py="2">
			<Link asChild color="gray">
				<RouterLink to="/">{t("board")}</RouterLink>
			</Link>
			<Link asChild color="gray">
				<RouterLink to="/backlog">{t("backlog")}</RouterLink>
			</Link>
		</Flex>
	);
};

const SideBar = () => (
	<Box width="128px" flexShrink="0">
		<Box p="4">
			<Heading as="h1" size="5" align="center">
				<Link asChild underline="none" highContrast>
					<RouterLink to="/">DBug</RouterLink>
				</Link>
			</Heading>
		</Box>
		<Stats />
		<LanguageSelector />
		<Separator size="4" />
		<Navigation />
		<SignOut />
	</Box>
);

const TopBar = () => {
	const { t } = useTranslation();
	const [isOpen, setIsOpen] = useState(false);

	const handleOpen = () => setIsOpen(true);
	const handleClose = () => setIsOpen(false);

	return (
		<Flex asChild justify="end" px="4" pt="4">
			<header>
				<Button type="button" onClick={handleOpen}>
					{t("create")}
				</Button>
				{isOpen && <TicketModal onClose={handleClose} />}
			</header>
		</Flex>
	);
};

const AppLayout = () => (
	<>
		<SideBar />
		<Flex direction="column" flexGrow="1">
			<TopBar />
			<Outlet />
		</Flex>
	</>
);

export const Route = createFileRoute("/_app")({
	beforeLoad: () => {
		if (!authenticated()) throw redirect({ to: "/sign-in" });
	},
	component: AppLayout,
});
