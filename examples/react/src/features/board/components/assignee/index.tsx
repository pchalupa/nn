import { Flex, Text } from "@radix-ui/themes";
import { useTranslation } from "react-i18next";

import { PersonAvatar, type Person } from "@/components/person-avatar";
import { UnassignedAvatar } from "@/components/person-avatar/parts/unassigned-avatar";

interface AssigneeProps {
	user?: Person;
}

/** Renders an avatar next to the person's name, or only the unassigned avatar, named Unassigned for assistive tech. */
export const Assignee = ({ user }: AssigneeProps) => {
	const { t } = useTranslation();

	if (!user) return <UnassignedAvatar size="1" label={t("unassigned")} />;

	return (
		<Flex gap="2" align="center">
			<PersonAvatar user={user} />
			<Text size="1" color="gray">
				{user.name}
			</Text>
		</Flex>
	);
};
