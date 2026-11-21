import { Grid } from "@radix-ui/themes";
import { createFileRoute, Outlet } from "@tanstack/react-router";
import { status } from "example-schema";
import { useTranslation } from "react-i18next";

import { Column } from "../../components/column";
import { statusLabels } from "../../i18n";

const Board = () => {
	const { t } = useTranslation();

	return (
		<Grid columns={`repeat(${status.literals.length}, minmax(200px, 1fr))`} gap="2" p="4" overflowX="auto">
			{status.literals.map((literal) => (
				<Column key={literal} title={t(statusLabels[literal])} status={literal} />
			))}
			<Outlet />
		</Grid>
	);
};

export const Route = createFileRoute("/_app/_board")({
	component: Board,
});
