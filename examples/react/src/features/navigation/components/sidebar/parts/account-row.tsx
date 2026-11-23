import { Flex, Link as ThemeLink, Text } from "@radix-ui/themes";
import { Link, useMatch } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

import { PersonAvatar } from "@/components/person-avatar";
import { useUser } from "@/features/authentication/authentication";

interface AccountRowProps {
	onNavigate?: () => void;
}

/** Links to the profile page with the current user avatar and name. */
export const AccountRow = ({ onNavigate }: AccountRowProps) => {
	const { t } = useTranslation();
	const { user } = useUser();
	const profile = useMatch({ from: "/_app/profile", shouldThrow: false });
	let background: string | undefined;

	if (profile) background = "var(--gray-a4)";

	return (
		<Flex
			asChild
			align="center"
			gap="2"
			p="2"
			className="nav-row"
			style={{ borderRadius: "var(--radius-3)", background }}
		>
			<ThemeLink asChild underline="none" color="gray" highContrast>
				<Link to="/profile" onClick={onNavigate}>
					<PersonAvatar user={user} size="1" />
					<Text size="2" weight="medium" truncate>
						{user?.name ?? t("unknownUser")}
					</Text>
				</Link>
			</ThemeLink>
		</Flex>
	);
};
