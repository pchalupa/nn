import { Button, Flex, Heading, Text } from "@radix-ui/themes";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

/** Renders the 404 page for a URL that matches no route or no data on this device, linking back to all boards. */
export const NotFound = () => {
	const { t } = useTranslation();

	return (
		<Flex direction="column" align="center" justify="center" gap="3" p="6" flexGrow="1">
			<Heading as="h1" size="6">
				{t("pageNotFound")}
			</Heading>
			<Text color="gray" align="center">
				{t("pageNotFoundBody")}
			</Text>
			<Button asChild variant="soft">
				<Link to="/">{t("allBoards")}</Link>
			</Button>
		</Flex>
	);
};
