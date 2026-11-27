import { Text } from "@radix-ui/themes";
import { Trans } from "react-i18next";

import { StatNumber } from "./stat-number";

interface StatProps {
	i18nKey: "assignedCount";
	count: number;
}

/** Renders a counted stat: an inline line from `md` up, the number above its label on mobile. */
export const Stat = ({ i18nKey, count }: StatProps) => (
	<Text as="div" size="1" color="gray">
		<Trans i18nKey={i18nKey} count={count} components={{ number: <StatNumber /> }} />
	</Text>
);
