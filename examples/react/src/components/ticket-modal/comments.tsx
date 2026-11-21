import type { Comment } from "example-schema";
import { useTranslation } from "react-i18next";

export const Comments = ({ comments }: { comments?: Comment[] }) => {
	const { t } = useTranslation();

	return (
		<section className="mt-6 flex flex-col gap-y-4" aria-label={t("comments")}>
			<h2 className="text-xs font-medium text-zinc-400 uppercase">{t("comments")}</h2>
			{comments?.length === 0 ? (
				<p className="text-sm text-zinc-500">{t("noComments")}</p>
			) : (
				comments?.map((comment) => (
					<article key={comment.id} className="rounded bg-zinc-900 p-4">
						<header className="mb-2 flex flex-wrap gap-2 text-xs text-zinc-400">
							<time dateTime={comment.createdAt}>{comment.createdAt}</time>
						</header>
						<p className="text-sm whitespace-pre-wrap">{comment.body}</p>
					</article>
				))
			)}
		</section>
	);
};
