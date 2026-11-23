import { Flex, Text, TextArea } from "@radix-ui/themes";
import { useFormatForDisplay, useHotkey } from "@tanstack/react-hotkeys";
import { type ChangeEvent, useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { useUser } from "../../../authentication/authentication";
import { useMutation, useQuery } from "../../../../store";
import { Caption } from "../../../../components/caption";
import { CommentItem } from "./comment-item";

interface CommentsProps {
	ticketId: string;
}

/** Lists a ticket's comments and posts a new one on Mod+Enter. */
export const Comments = ({ ticketId }: CommentsProps) => {
	const { t } = useTranslation();
	const comments = useQuery((data) => data.tickets.find((ticket) => ticket.id === ticketId)?.comments ?? []);
	const mutate = useMutation();
	const { id: userId } = useUser();
	const [body, setBody] = useState("");
	const hintId = useId();
	const textAreaRef = useRef<HTMLTextAreaElement>(null);
	const formatForDisplay = useFormatForDisplay();

	const handleChange = (event: ChangeEvent<HTMLTextAreaElement>) => setBody(event.target.value);

	const handlePost = () => {
		const text = body.trim();

		if (text === "") return;

		mutate((data) => {
			const ticket = data.tickets.find((entry) => entry.id === ticketId);

			ticket?.comments.push({
				id: crypto.randomUUID(),
				author: userId ?? "",
				createdAt: new Date().toISOString(),
				body: text,
			});
		});
		setBody("");
	};

	useHotkey("Mod+Enter", handlePost, { target: textAreaRef });

	return (
		<Flex asChild direction="column" gap="3">
			<section aria-label={t("comments")}>
				<Caption as="h2">{t("commentsCount", { count: comments.length })}</Caption>
				{comments.length === 0 && (
					<Text as="p" size="2" color="gray">
						{t("noComments")}
					</Text>
				)}
				{comments.map((comment) => (
					<CommentItem key={comment.id} comment={comment} />
				))}
				<Flex direction="column" gap="1">
					<TextArea
						aria-label={t("writeComment")}
						aria-describedby={hintId}
						placeholder={t("writeComment")}
						ref={textAreaRef}
						value={body}
						onChange={handleChange}
					/>
					<Text id={hintId} size="1" color="gray">
						{t("postCommentHint", { hotkey: formatForDisplay("Mod+Enter") })}
					</Text>
				</Flex>
			</section>
		</Flex>
	);
};
