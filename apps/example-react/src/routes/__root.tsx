import { createRootRoute, Link, Outlet } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

import { Divider } from "../components/Divider";
import { LanguageSelector } from "../components/LanguageSelector";
import { Skeleton } from "../components/Skeleton";
import { useStore } from "../store";

const RootComponent = () => (
	<div className="flex flex-row bg-zinc-900">
		<SideBar />
		<Outlet />
	</div>
);

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
	</div>
);

const Stats = () => {
	const { t } = useTranslation();
	const data = useStore((store) => store.tickets);

	return <p className="text-center text-zinc-600">{t("tickets", { count: data.length })}</p>;
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

export const Route = createRootRoute({
	component: RootComponent,
});
