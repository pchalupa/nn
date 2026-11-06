import { useTranslation } from "react-i18next";

import { useRead } from "../store";

export function TicketComments({ ticketId }: { ticketId: string }) {
	const { t } = useTranslation();
	const comments = useRead((state) =>
		state.comments.reduce<Array<{ id: string; body: string; createdAt: string; author?: string }>>(
			(result, comment) => {
				if (comment.ticketId === ticketId) {
					const author = state.users.find((user) => user.id === comment.authorId)?.name;

					result.push({
						id: comment.id,
						body: comment.body,
						createdAt: new Date(comment.createdAt).toLocaleString(),
						author,
					});
				}

				return result;
			},
			[],
		),
	);

	return (
		<section className="mt-6 flex flex-col gap-4" aria-label={t("comments")}>
			<h2 className="text-sm font-medium text-zinc-400">{t("comments")}</h2>
			{comments.map((comment) => (
				<article key={comment.id} className="rounded bg-zinc-900 p-4">
					<header className="mb-2 flex flex-wrap gap-2 text-xs text-zinc-400">
						<span>{comment.author}</span>
						<time dateTime={comment.createdAt}>{comment.createdAt}</time>
					</header>
					<p className="text-sm whitespace-pre-wrap">{comment.body}</p>
				</article>
			))}
		</section>
	);
}
