import { useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

import { signOut } from "../../modules/authentication";

export const SignOut = () => {
	const { t } = useTranslation();
	const navigate = useNavigate();

	const handleSignOut = () => {
		signOut();
		navigate({ to: "/sign-in" });
	};

	return (
		<div className="px-4 py-2">
			<button type="button" className="text-xs text-zinc-400 hover:text-zinc-200" onClick={handleSignOut}>
				{t("signOut")}
			</button>
		</div>
	);
};
