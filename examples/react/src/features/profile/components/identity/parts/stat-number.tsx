import { Text } from "@radix-ui/themes";
import type { ReactNode } from "react";

interface StatNumberProps {
	children?: ReactNode;
}

/** Renders a stat's number: medium weight inline from `md` up, a bold block on mobile. */
export const StatNumber = ({ children }: StatNumberProps) => (
	<Text
		size={{ initial: "5", md: "1" }}
		weight={{ initial: "bold", md: "medium" }}
		mb={{ initial: "1", md: "0" }}
		className="stat-number"
	>
		{children}
	</Text>
);
