import { TextField } from "@radix-ui/themes";
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useForm, useFormState } from "react-hook-form";
import { useTranslation } from "react-i18next";

import { Field } from "@/components/field";
import { authenticated, signUp } from "@/features/authentication/authentication";
import { AuthCard } from "@/features/authentication/components/auth-card";
import { useMutation } from "@/store";

const SignUp = () => {
	const { t } = useTranslation();
	const navigate = useNavigate();
	const mutate = useMutation();
	const form = useForm({ defaultValues: { name: "" } });
	const { errors, isSubmitting } = useFormState({ control: form.control });
	let nameError: string | undefined;

	if (errors.name) nameError = t("nameRequired");

	const handleSubmit = form.handleSubmit(async ({ name }) => {
		try {
			const account = await signUp({ name: name.trim() });

			mutate((draft) => {
				draft.users.push(account);
			});
			navigate({ to: "/" });
		} catch {
			form.setError("root", { message: t("authFailed") });
		}
	});

	return (
		<AuthCard
			title={t("signUpTitle")}
			body={t("signUpBody")}
			switchText={t("haveAccount")}
			switchLink={{ to: "/sign-in", label: t("signIn") }}
			submitting={isSubmitting}
			error={errors.root?.message}
			onSubmit={handleSubmit}
		>
			<Field label={t("name")} hint={t("nameHint")} error={nameError}>
				<TextField.Root
					size={{ initial: "3", md: "2" }}
					autoComplete="name"
					placeholder={t("namePlaceholder")}
					{...form.register("name", { validate: (value) => value.trim() !== "" })}
				/>
			</Field>
		</AuthCard>
	);
};

export const Route = createFileRoute("/sign-up")({
	beforeLoad: () => {
		if (authenticated()) throw redirect({ to: "/" });
	},
	component: SignUp,
	wrapInSuspense: true,
});
