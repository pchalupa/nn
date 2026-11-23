import { KeyIcon } from "@phosphor-icons/react";
import { Box, Button, Card, Flex, Heading, Link, Text } from "@radix-ui/themes";
import { type LinkProps, Link as RouterLink } from "@tanstack/react-router";
import type { ReactNode, SubmitEventHandler } from "react";
import { useTranslation } from "react-i18next";

import { Brand } from "@/components/brand";

interface AuthCardProps {
	title: string;
	body: string;
	switchText: string;
	switchLink: { to: LinkProps["to"]; label: string };
	submitting: boolean;
	error?: string;
	onSubmit: SubmitEventHandler<HTMLFormElement>;
	children?: ReactNode;
}

/** Renders an auth page form: a centered card from `md` up, a full-height page with bottom actions below it. */
export const AuthCard = ({
	title,
	body,
	switchText,
	switchLink,
	submitting,
	error,
	onSubmit,
	children,
}: AuthCardProps) => {
	const { t } = useTranslation();

	return (
		<Flex
			asChild
			direction="column"
			align={{ initial: "stretch", md: "center" }}
			justify={{ initial: "start", md: "center" }}
			flexGrow="1"
			p={{ initial: "5", md: "0" }}
			position="relative"
		>
			<main>
				<Box display={{ initial: "none", md: "block" }} position="absolute" top="6" left="7">
					<Brand size="1" />
				</Box>
				<Flex
					asChild
					display="flex"
					direction="column"
					flexGrow={{ initial: "1", md: "0" }}
					width={{ initial: "auto", md: "360px" }}
				>
					<Card size="3" className="desktop-card">
						<Flex asChild direction="column" justify="between" gap={{ initial: "5", md: "4" }} flexGrow="1">
							<form noValidate onSubmit={onSubmit}>
								<Flex direction="column" gap={{ initial: "5", md: "4" }}>
									<Flex direction="column" gap={{ initial: "2", md: "1" }}>
										<Flex pb={{ initial: "7", md: "2" }}>
											<Brand size="2" nameDisplay={{ initial: "flex", md: "none" }} />
										</Flex>
										<Heading as="h1" size={{ initial: "7", md: "4" }}>
											{title}
										</Heading>
										<Text as="p" size={{ initial: "3", md: "2" }} color="gray">
											{body}
										</Text>
									</Flex>
									{children}
								</Flex>
								<Flex direction="column" gap={{ initial: "2", md: "4" }}>
									<Flex direction="column" gap="2">
										<Button type="submit" size={{ initial: "4", md: "3" }} disabled={submitting}>
											<Flex align="center" gap="2">
												<KeyIcon size={16} />
												<Text size={{ initial: "3", md: "2" }} weight="medium">
													{t("continueWithPasskey")}
												</Text>
											</Flex>
										</Button>
										{error !== undefined && (
											<Text size="1" color="red" role="alert">
												{error}
											</Text>
										)}
									</Flex>
									<Flex justify="center" align="center" gap="1" height={{ initial: "44px", md: "auto" }}>
										<Text size={{ initial: "2", md: "1" }} color="gray">
											{switchText}
										</Text>
										<Link asChild size={{ initial: "2", md: "1" }} weight="medium" underline="hover">
											<RouterLink to={switchLink.to}>{switchLink.label}</RouterLink>
										</Link>
									</Flex>
								</Flex>
							</form>
						</Flex>
					</Card>
				</Flex>
			</main>
		</Flex>
	);
};
