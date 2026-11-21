import { Button, Card, Flex, Heading, Link, Separator, Text, TextField } from "@radix-ui/themes";
import { createFileRoute, Link as RouterLink, redirect, useNavigate } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";

import { Field } from "../components/field";
import { signUp } from "../modules/authentication/authentication";
import { authenticated } from "../modules/authentication/session";
import { useMutation } from "../store";

const SignUp = () => {
	const { t } = useTranslation();
	const navigate = useNavigate();
	const mutate = useMutation();
	const form = useForm({ defaultValues: { name: "" } });

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
		<Flex asChild flexGrow="1" align="center" justify="center">
			<main>
				<Card size="3">
					<Flex direction="column" gap="4" width="280px">
						<Heading as="h1" size="5" align="center">
							{t("welcome")}
						</Heading>
						<form noValidate onSubmit={handleSubmit}>
							<Flex direction="column" gap="3">
								<Field label={t("name")}>
									<TextField.Root autoComplete="name" {...form.register("name")} />
								</Field>
								<Button type="submit" disabled={form.formState.isSubmitting}>
									{t("signUp")}
								</Button>
							</Flex>
						</form>
						<Separator size="4" />
						<Text as="p" size="2" align="center">
							<Link asChild color="gray">
								<RouterLink to="/sign-in">{t("signIn")}</RouterLink>
							</Link>
						</Text>
					</Flex>
				</Card>
			</main>
		</Flex>
	);
};

export const Route = createFileRoute("/sign-up")({
	beforeLoad: () => {
		if (authenticated()) throw redirect({ to: "/" });
	},
	component: SignUp,
	wrapInSuspense: true,
});
