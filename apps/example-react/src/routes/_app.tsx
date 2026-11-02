import { createFileRoute, Link, Outlet, redirect } from "@tanstack/react-router";
import { Suspense, useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "../components/Button";
import { Divider } from "../components/Divider";
import { LanguageSelector } from "../components/LanguageSelector";
import { SignOut } from "../components/SignOut";
import { Skeleton } from "../components/Skeleton";
import { TicketModal } from "../components/TicketModal";
import { authenticated } from "../modules/authentication";
import { useRead } from "../store";

const Stats = () => {
	const { t } = useTranslation();
	const count = useRead((data) => data.tickets.length);

	return <p className="text-center text-zinc-600">{t("tickets", { count })}</p>;
};

const Navigation = () => {
	const { t } = useTranslation();

	return (
		<div className="flex flex-col gap-y-2 px-4 py-2">
			<Link to="/" className="text-zinc-400">
				{t("board")}
			</Link>
			<Link to="/backlog" className="text-zinc-400">
				{t("backlog")}
			</Link>
		</div>
	);
};

const SideBar = () => (
	<div className="min-h-screen w-1/4 max-w-32 min-w-28 bg-zinc-800">
		<Link to="/">
			<h1 className="p-4 text-center text-xl font-bold text-zinc-200">DBug</h1>
		</Link>
		<Skeleton width="w-3/4" height="h-6" className="mx-2">
			<Stats />
		</Skeleton>
		<Skeleton width="w-3/4" height="h-14" className="mx-2">
			<LanguageSelector />
		</Skeleton>
		<Divider />
		<Navigation />
		<SignOut />
	</div>
);

const TopBar = () => {
	const { t } = useTranslation();
	const [isOpen, setIsOpen] = useState(false);

	const handleOpen = () => setIsOpen(true);
	const handleClose = () => setIsOpen(false);

	return (
		<header className="flex flex-row justify-end px-4 pt-4">
			<Button text={t("create")} size="sm" onClick={handleOpen} />
			{isOpen && (
				<Suspense>
					<TicketModal onClose={handleClose} />
				</Suspense>
			)}
		</header>
	);
};

const AppLayout = () => (
	<>
		<SideBar />
		<div className="flex flex-1 flex-col">
			<TopBar />
			<Outlet />
		</div>
	</>
);

export const Route = createFileRoute("/_app")({
	beforeLoad: () => {
		if (!authenticated()) throw redirect({ to: "/sign-in" });
	},
	component: AppLayout,
});
