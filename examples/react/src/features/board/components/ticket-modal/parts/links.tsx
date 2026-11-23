import { Flex, Kbd, Text, TextField } from "@radix-ui/themes";
import type { Link } from "example-schema";
import { type ChangeEvent, type KeyboardEvent, useId, useState } from "react";
import { useTranslation } from "react-i18next";

import { Caption } from "@/components/caption";
import { describeLink, parseLinkInput } from "@/features/board/links";

import { LinkRow } from "./link-row";

interface LinksProps {
	links: readonly Link[];
	onAdd: (link: Link) => void;
	onRemove: (id: string) => void;
}

/** Lists links and adds one from a pasted URL on Enter. */
export const Links = ({ links, onAdd, onRemove }: LinksProps) => {
	const { t } = useTranslation();
	const [text, setText] = useState("");
	const [invalid, setInvalid] = useState(false);
	const inputId = useId();
	const errorId = useId();
	let describedBy: string | undefined;

	if (invalid) describedBy = errorId;

	const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
		setText(event.target.value);
		setInvalid(false);
	};

	const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
		if (event.key !== "Enter" || event.metaKey || event.ctrlKey || event.nativeEvent.isComposing) return;

		event.preventDefault();

		if (text.trim() === "") return;

		const url = parseLinkInput(text);

		if (!url) {
			setInvalid(true);

			return;
		}

		onAdd({ id: crypto.randomUUID(), url, title: describeLink(url).title });
		setText("");
	};

	return (
		<Flex direction="column" gap="2">
			<Text as="label" htmlFor={inputId} size="1" weight="medium" color="gray">
				<Caption>{t("links")}</Caption>
			</Text>
			{links.map((link) => (
				<LinkRow key={link.id} link={link} onRemove={() => onRemove(link.id)} />
			))}
			<TextField.Root
				id={inputId}
				placeholder={t("addLinkPlaceholder")}
				aria-describedby={describedBy}
				aria-invalid={invalid || undefined}
				value={text}
				onChange={handleChange}
				onKeyDown={handleKeyDown}
			>
				<TextField.Slot side="right">
					<Kbd>↵</Kbd>
				</TextField.Slot>
			</TextField.Root>
			{invalid && (
				<Text id={errorId} size="1" color="red">
					{t("invalidLink")}
				</Text>
			)}
		</Flex>
	);
};
