import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";

import { classNames } from "../components/button/index.styles";
import { Divider } from "../components/divider";
import { signIn } from "../modules/authentication/authentication";
import { authenticated } from "../modules/authentication/session";
import { useRead } from "../store";

const SignIn = () => {
	const { t } = useTranslation();
	const navigate = useNavigate();
	const accounts = useRead((data) => data.users);
	const form = useForm();

	const handleSubmit = form.handleSubmit(async () => {
		try {
			await signIn(accounts);
			navigate({ to: "/" });
		} catch {
			form.setError("root", { message: t("authFailed") });
		}
	});

	return (
		<main className="flex min-h-screen flex-1 items-center justify-center">
			<div className="flex w-80 flex-col gap-y-4 rounded bg-zinc-800 p-6">
				<h1 className="text-center text-xl font-bold text-zinc-200">{t("welcome")}</h1>
				<form className="flex flex-col" onSubmit={handleSubmit}>
					<button type="submit" className={classNames()} disabled={form.formState.isSubmitting}>
						{t("signIn")}
					</button>
				</form>
				<Divider />
				<Link to="/sign-up" className="text-center text-sm text-zinc-400 hover:text-zinc-200">
					{t("signUp")}
				</Link>
			</div>
		</main>
	);
};

export const Route = createFileRoute("/sign-in")({
	beforeLoad: () => {
		if (authenticated()) throw redirect({ to: "/" });
	},
	component: SignIn,
	wrapInSuspense: true,
});
