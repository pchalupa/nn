import { createFileRoute, Outlet } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

import { Column } from "../components/Column";
import { Skeleton } from "../components/Skeleton";

const Board = () => {
	const { t } = useTranslation();

	return (
		<div className="flex h-full flex-1 flex-row gap-x-2 overflow-x-scroll p-4">
			<Skeleton width="w-full" height="h-56">
				<Column title={t("todo")} status="todo" />
			</Skeleton>
			<Skeleton width="w-full" height="h-56">
				<Column title={t("inProgress")} status="in-progress" />
			</Skeleton>
			<Skeleton width="w-full" height="h-56">
				<Column title={t("done")} status="done" />
			</Skeleton>
			<Outlet />
		</div>
	);
};

export const Route = createFileRoute("/_board")({
	component: Board,
});
