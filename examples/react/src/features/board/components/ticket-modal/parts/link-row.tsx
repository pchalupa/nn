import { XIcon } from "@phosphor-icons/react";
import { Card, Code, Flex, IconButton } from "@radix-ui/themes";
import type { Link } from "example-schema";
import { useTranslation } from "react-i18next";

import { describeLink } from "@/features/board/links";

import { LinkKindIcon } from "./link-kind-icon";
import { LinkTitle } from "./link-title";

interface LinkRowProps {
	link: Link;
	onRemove: () => void;
}

/** Renders one link as a row with its kind, title, meta and a remove button. */
export const LinkRow = ({ link, onRemove }: LinkRowProps) => {
	const { t } = useTranslation();
	const description = describeLink(link.url);
	let title = link.title;

	if (title === "") title = description.title;

	return (
		<Card asChild size="1">
			<Flex display="flex" align="center" gap="2" px="3" py="0" height="36px">
				<LinkKindIcon kind={description.kind} />
				<Flex flexGrow="1" minWidth="0">
					<LinkTitle url={link.url} title={title} />
				</Flex>
				{description.meta !== "" && (
					<Code size="1" variant="ghost" color="gray">
						{description.meta}
					</Code>
				)}
				<IconButton
					type="button"
					size="1"
					variant="ghost"
					color="gray"
					aria-label={t("removeLink", { title })}
					onClick={onRemove}
				>
					<XIcon size={16} />
				</IconButton>
			</Flex>
		</Card>
	);
};
