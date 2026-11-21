import { Card, Flex, Heading, Text } from "@radix-ui/themes";
import type { Comment } from "example-schema";
import { useTranslation } from "react-i18next";

export const Comments = ({ comments }: { comments?: Comment[] }) => {
	const { t } = useTranslation();

	return (
		<Flex asChild direction="column" gap="4" mt="6">
			<section aria-label={t("comments")}>
				<Heading as="h2" size="1" weight="medium" color="gray" style={{ textTransform: "uppercase" }}>
					{t("comments")}
				</Heading>
				{comments?.length === 0 ? (
					<Text as="p" size="2" color="gray">
						{t("noComments")}
					</Text>
				) : (
					comments?.map((comment) => (
						<Card asChild key={comment.id}>
							<article>
								<Text as="p" size="1" color="gray" mb="2">
									<time dateTime={comment.createdAt}>{comment.createdAt}</time>
								</Text>
								<Text as="p" size="2" style={{ whiteSpace: "pre-wrap" }}>
									{comment.body}
								</Text>
							</article>
						</Card>
					))
				)}
			</section>
		</Flex>
	);
};
