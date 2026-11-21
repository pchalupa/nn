import { Button, Card, Flex, Heading, Link, Separator, Text } from "@radix-ui/themes";
import { createFileRoute, Link as RouterLink, redirect, useNavigate } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";

import { signIn } from "../modules/authentication/authentication";
import { authenticated } from "../modules/authentication/session";
import { useQuery } from "../store";

const SignIn = () => {
	const { t } = useTranslation();
	const navigate = useNavigate();
	const accounts = useQuery((data) => data.users);
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
		<Flex asChild flexGrow="1" align="center" justify="center">
			<main>
				<Card size="3">
					<Flex direction="column" gap="4" width="280px">
						<Heading as="h1" size="5" align="center">
							{t("welcome")}
						</Heading>
						<form noValidate onSubmit={handleSubmit}>
							<Flex direction="column">
								<Button type="submit" disabled={form.formState.isSubmitting}>
									{t("signIn")}
								</Button>
							</Flex>
						</form>
						<Separator size="4" />
						<Text as="p" size="2" align="center">
							<Link asChild color="gray">
								<RouterLink to="/sign-up">{t("signUp")}</RouterLink>
							</Link>
						</Text>
					</Flex>
				</Card>
			</main>
		</Flex>
	);
};

export const Route = createFileRoute("/sign-in")({
	beforeLoad: () => {
		if (authenticated()) throw redirect({ to: "/" });
	},
	component: SignIn,
	wrapInSuspense: true,
});
