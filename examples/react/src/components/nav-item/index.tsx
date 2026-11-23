import { Flex, Link as ThemeLink, Text } from "@radix-ui/themes";
import { Link, type LinkComponentProps } from "@tanstack/react-router";
import type { ReactNode } from "react";

/** Row height of a nav item: `"1"` is the 30px desktop row, `"2"` the 44px touch row. */
export type NavItemSize = "1" | "2";

const heights = { "1": "30px", "2": "44px" } as const;

type NavItemProps = LinkComponentProps<"a"> & {
	active?: boolean;
	size?: NavItemSize;
	icon: ReactNode;
	label: string;
	count?: number;
};

/** Renders a sidebar link row with icon, label and optional count. */
export const NavItem = ({ size = "1", icon, label, count, active, ...link }: NavItemProps) => {
	let background: string | undefined;
	let current: "page" | undefined;

	if (active) {
		background = "var(--gray-a4)";
		current = "page";
	}

	return (
		<Flex
			asChild
			align="center"
			gap="2"
			px="2"
			height={heights[size]}
			className="nav-row"
			style={{ borderRadius: "var(--radius-2)", background }}
		>
			<ThemeLink asChild underline="none" color="gray" highContrast={active}>
				<Link {...link} activeOptions={{ exact: true }} aria-current={current}>
					{icon}
					<Text size="2">{label}</Text>
					{count !== undefined && (
						<Text size="1" color="gray" ml="auto">
							{count}
						</Text>
					)}
				</Link>
			</ThemeLink>
		</Flex>
	);
};
