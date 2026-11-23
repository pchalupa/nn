import { Grid } from "@radix-ui/themes";
import type { ReactNode } from "react";

interface ActionBarProps {
	children: ReactNode;
}

/** Renders the mobile bottom bar of full-width actions, hidden from `md` up. */
export const ActionBar = ({ children }: ActionBarProps) => (
	<Grid display={{ initial: "grid", md: "none" }} columns="1" gap="2" px="4" pb="3" flexShrink="0">
		{children}
	</Grid>
);
