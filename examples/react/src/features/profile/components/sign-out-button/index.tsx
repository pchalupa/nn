import { SignOutIcon } from "@phosphor-icons/react";
import { Button, Text } from "@radix-ui/themes";
import { useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

import { clearSession } from "@/features/authentication/session";

/** Renders the soft Sign out button that signs out and opens the sign-in page. */
export const SignOutButton = () => {
	const { t } = useTranslation();
	const navigate = useNavigate();

	const handleSignOut = () => {
		clearSession();
		navigate({ to: "/sign-in" });
	};

	return (
		<Button type="button" size={{ initial: "4", md: "2" }} variant="soft" color="gray" onClick={handleSignOut}>
			<SignOutIcon size={16} />
			<Text size="2">{t("signOut")}</Text>
		</Button>
	);
};
