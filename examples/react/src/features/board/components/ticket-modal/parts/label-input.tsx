import { Box, Flex, Text, TextField } from "@radix-ui/themes";
import { type FocusEvent, useEffect, useId, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { useTranslation } from "react-i18next";

import { Caption } from "@/components/caption";
import { Tag } from "@/components/tag";
import { Label } from "@/features/board/components/label-badge";

import { useLabelText } from "./use-label-text";

interface LabelInputProps {
	labels: string[];
	onAdd: (label: string) => void;
	onRemove: (label: string) => void;
}

/** Adds and removes a ticket's labels; below `md` the input stays hidden until "+ Add label" reveals it. */
export const LabelInput = ({ labels, onAdd, onRemove }: LabelInputProps) => {
	const { t } = useTranslation();
	const inputId = useId();
	const { text, setText, handleChange, handleKeyDown } = useLabelText(labels, onAdd);
	const [revealed, setRevealed] = useState(false);
	const groupRef = useRef<HTMLDivElement>(null);
	const inputRef = useRef<HTMLInputElement>(null);
	const addRef = useRef<HTMLButtonElement>(null);
	let inputDisplay: "block" | "none" = "none";
	let labelsDisplay: "flex" | "none" = "none";

	if (revealed) inputDisplay = "block";

	if (labels.length > 0) labelsDisplay = "flex";

	useEffect(() => {
		if (!revealed) return;

		const handleEscape = (event: KeyboardEvent) => {
			if (event.key !== "Escape" || event.target !== inputRef.current) return;

			event.stopPropagation();
			setText("");
			setRevealed(false);
			addRef.current?.focus();
		};

		globalThis.addEventListener("keydown", handleEscape, { capture: true });

		return () => globalThis.removeEventListener("keydown", handleEscape, { capture: true });
	}, [revealed, setText]);

	const handleReveal = () => {
		flushSync(() => setRevealed(true));
		inputRef.current?.focus();
	};

	const handleBlur = (event: FocusEvent<HTMLInputElement>) => {
		const next = event.relatedTarget;

		if (text.trim() !== "" || (next instanceof Node && groupRef.current?.contains(next))) return;

		setRevealed(false);
	};

	return (
		<Flex ref={groupRef} direction="column" gap="2">
			<Text as="label" htmlFor={inputId} size="1" weight="medium" color="gray">
				<Caption>{t("labels")}</Caption>
			</Text>
			<Flex direction={{ initial: "column-reverse", md: "column" }} gap="2">
				<Box display={{ initial: inputDisplay, md: "block" }}>
					<TextField.Root
						ref={inputRef}
						id={inputId}
						placeholder={t("addLabelPlaceholder")}
						value={text}
						onChange={handleChange}
						onKeyDown={handleKeyDown}
						onBlur={handleBlur}
					/>
				</Box>
				<Flex display={{ initial: "flex", md: labelsDisplay }} wrap="wrap" align="center" gap="1">
					{labels.map((label) => (
						<Label key={label} name={label} onRemove={() => onRemove(label)} />
					))}
					<Box display={{ initial: "contents", md: "none" }}>
						<Tag ref={addRef} onClick={handleReveal}>
							{t("addLabel")}
						</Tag>
					</Box>
				</Flex>
			</Flex>
		</Flex>
	);
};
