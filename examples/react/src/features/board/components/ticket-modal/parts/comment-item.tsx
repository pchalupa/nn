import { Flex, Text } from "@radix-ui/themes";
import type { Comment } from "example-schema";
import { useTranslation } from "react-i18next";

import { PersonAvatar } from "@/components/person-avatar";
import { useQuery } from "@/store";

const formatTime = (value: string, language: string) => {
	const date = new Date(value);

	if (Number.isNaN(date.getTime())) return value;

	return new Intl.DateTimeFormat(language, {
		month: "short",
		day: "numeric",
		hour: "2-digit",
		minute: "2-digit",
	}).format(date);
};

interface CommentItemProps {
	comment: Comment;
}

/** Renders one comment with its author and time. */
export const CommentItem = ({ comment }: CommentItemProps) => {
	const { t, i18n } = useTranslation();
	const author = useQuery((data) => data.users.find((user) => user.id === comment.author));

	return (
		<Flex asChild gap="2">
			<article>
				<PersonAvatar user={author} />
				<Flex direction="column" gap="1" minWidth="0">
					<Flex align="center" gap="2">
						<Text size="2" weight="medium">
							{author?.name ?? t("unknownUser")}
						</Text>
						<Text size="1" color="gray">
							<time dateTime={comment.createdAt}>{formatTime(comment.createdAt, i18n.language)}</time>
						</Text>
					</Flex>
					<Text as="p" size="2" color="gray" style={{ whiteSpace: "pre-wrap" }}>
						{comment.body}
					</Text>
				</Flex>
			</article>
		</Flex>
	);
};
