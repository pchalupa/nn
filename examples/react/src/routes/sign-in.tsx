import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useForm, useFormState } from "react-hook-form";
import { useTranslation } from "react-i18next";

import { authenticated, signIn } from "@/features/authentication/authentication";
import { AuthCard } from "@/features/authentication/components/auth-card";
import { useQuery } from "@/store";

const SignIn = () => {
	const { t } = useTranslation();
	const navigate = useNavigate();
	const accounts = useQuery((data) => data.users);
	const form = useForm();
	const { errors, isSubmitting } = useFormState({ control: form.control });

	const handleSubmit = form.handleSubmit(async () => {
		try {
			await signIn(accounts);
			navigate({ to: "/" });
		} catch {
			form.setError("root", { message: t("authFailed") });
		}
	});

	return (
		<AuthCard
			title={t("signInTitle")}
			body={t("signInBody")}
			switchText={t("newHere")}
			switchLink={{ to: "/sign-up", label: t("createAccount") }}
			submitting={isSubmitting}
			error={errors.root?.message}
			onSubmit={handleSubmit}
		/>
	);
};

export const Route = createFileRoute("/sign-in")({
	beforeLoad: () => {
		if (authenticated()) throw redirect({ to: "/" });
	},
	component: SignIn,
	wrapInSuspense: true,
});
