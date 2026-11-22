import { KeyIcon } from "@phosphor-icons/react";
import { Box, Button, Card, Flex, Heading, Link, Text } from "@radix-ui/themes";
import { createFileRoute, Link as RouterLink, redirect, useNavigate } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";

import { Brand } from "../components/brand";
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
		<Flex asChild flexGrow="1" align="center" justify="center" position="relative">
			<main>
				<Box position="absolute" top="6" left="7">
					<Brand size="1" />
				</Box>
				<Box width="360px">
					<Card size="3">
						<Flex direction="column" gap="4">
							<Flex direction="column" gap="1">
								<Flex pb="2">
									<Brand size="2" />
								</Flex>
								<Heading as="h1" size="4">
									{t("signInTitle")}
								</Heading>
								<Text as="p" size="2" color="gray">
									{t("signInBody")}
								</Text>
							</Flex>
							<form noValidate onSubmit={handleSubmit}>
								<Flex direction="column" gap="2">
									<Button type="submit" size="3" disabled={form.formState.isSubmitting}>
										<KeyIcon size={16} />
										{t("continueWithPasskey")}
									</Button>
									{form.formState.errors.root && (
										<Text size="1" color="red">
											{form.formState.errors.root.message}
										</Text>
									)}
								</Flex>
							</form>
							<Flex justify="center" gap="1">
								<Text size="1" color="gray">
									{t("newHere")}
								</Text>
								<Link asChild size="1" weight="medium" underline="hover">
									<RouterLink to="/sign-up">{t("createAccount")}</RouterLink>
								</Link>
							</Flex>
						</Flex>
					</Card>
				</Box>
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
