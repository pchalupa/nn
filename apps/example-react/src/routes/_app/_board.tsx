import { createFileRoute, Outlet } from "@tanstack/react-router";
import { status } from "example-schema";
import { useTranslation } from "react-i18next";

import { Column } from "../../components/column";
import { Skeleton } from "../../components/skeleton";
import { statusLabels } from "../../i18n";

const Board = () => {
	const { t } = useTranslation();

	return (
		<div className="flex h-full flex-1 flex-row gap-x-2 overflow-x-scroll p-4">
			{status.literals.map((literal) => (
				<Skeleton key={literal} width="w-full" height="h-56">
					<Column title={t(statusLabels[literal])} status={literal} />
				</Skeleton>
			))}
			<Outlet />
		</div>
	);
};

export const Route = createFileRoute("/_app/_board")({
	component: Board,
});
