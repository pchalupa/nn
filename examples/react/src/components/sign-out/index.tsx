import { Box, Button } from "@radix-ui/themes";
import { useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

import { signOut } from "../../modules/authentication/session";

export const SignOut = () => {
	const { t } = useTranslation();
	const navigate = useNavigate();

	const handleSignOut = () => {
		signOut();
		navigate({ to: "/sign-in" });
	};

	return (
		<Box px="4" py="2">
			<Button type="button" variant="ghost" color="gray" size="1" onClick={handleSignOut}>
				{t("signOut")}
			</Button>
		</Box>
	);
};
