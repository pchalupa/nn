import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";

import { classNames } from "../components/Button/index.styles";
import { Divider } from "../components/Divider";
import { Input } from "../components/Input";
import { authenticated, signUp } from "../modules/authentication";
import { useUpdate } from "../store";

const SignUp = () => {
	const { t } = useTranslation();
	const navigate = useNavigate();
	const updateStore = useUpdate();
	const form = useForm({ defaultValues: { name: "" } });

	const handleSubmit = form.handleSubmit(async ({ name }) => {
		try {
			const account = await signUp({ name: name.trim() });

			updateStore((draft) => {
				draft.users.push(account);
			});
			navigate({ to: "/" });
		} catch {
			form.setError("root", { message: t("authFailed") });
		}
	});

	return (
		<main className="flex min-h-screen flex-1 items-center justify-center">
			<div className="flex w-80 flex-col gap-y-4 rounded bg-zinc-800 p-6">
				<h1 className="text-center text-xl font-bold text-zinc-200">{t("welcome")}</h1>
				<form className="flex flex-col gap-y-3" noValidate onSubmit={handleSubmit}>
					<Input label={t("name")} autoComplete="name" {...form.register("name")} />
					<button type="submit" className={classNames()} disabled={form.formState.isSubmitting}>
						{t("signUp")}
					</button>
				</form>
				<Divider />
				<Link to="/welcome" className="text-center text-sm text-zinc-400 hover:text-zinc-200">
					{t("signIn")}
				</Link>
			</div>
		</main>
	);
};

export const Route = createFileRoute("/sign-up")({
	beforeLoad: () => {
		if (authenticated()) throw redirect({ to: "/" });
	},
	component: SignUp,
	wrapInSuspense: true,
});
