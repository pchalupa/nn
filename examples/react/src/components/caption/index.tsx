import { Text } from "@radix-ui/themes";
import type { ReactNode } from "react";

interface CaptionProps {
	as?: "span" | "h2";
	id?: string;
	children: ReactNode;
}

/** Renders text in the uppercase caption style. */
export const Caption = ({ as: Element = "span", id, children }: CaptionProps) => (
	<Text asChild size="1" weight="medium" color="gray" style={{ textTransform: "uppercase" }}>
		<Element id={id}>{children}</Element>
	</Text>
);
