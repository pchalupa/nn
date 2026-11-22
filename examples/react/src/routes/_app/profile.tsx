import { UserIcon } from "@phosphor-icons/react";
import { Flex } from "@radix-ui/themes";
import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

import { PageHeader } from "../../components/page-header";
import { Identity } from "../../components/profile/identity";
import { ProfileForm } from "../../components/profile/profile-form";

const Profile = () => {
	const { t } = useTranslation();

	return (
		<>
			<PageHeader icon={<UserIcon size={16} color="var(--gray-a11)" />} title={t("profile")} />
			<Flex direction="column" py="7" px="8" gap="7" overflowY="auto">
				<Identity />
				<ProfileForm />
			</Flex>
		</>
	);
};

export const Route = createFileRoute("/_app/profile")({
	component: Profile,
});
