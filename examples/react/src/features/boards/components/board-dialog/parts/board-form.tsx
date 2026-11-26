import { PlusIcon } from "@phosphor-icons/react";
import { Button, Dialog, Flex, Grid, Text, TextArea, TextField } from "@radix-ui/themes";
import type { SubmitEvent } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";

import { Field } from "@/components/field";
import type { BoardDetails } from "@/features/boards/board-details";
import { useMutation } from "@/store";

interface BoardFormProps {
	board?: BoardDetails;
	onDone: () => void;
}

interface BoardTexts {
	name: string;
	description: string;
}

/** Renders the board's name and description fields and creates or updates the board on submit. */
export const BoardForm = ({ board, onDone }: BoardFormProps) => {
	const { t } = useTranslation();
	const mutate = useMutation();
	const form = useForm<BoardTexts>({
		defaultValues: { name: board?.name ?? "", description: board?.description ?? "" },
	});
	const error = form.formState.errors.name?.message;

	const save = form.handleSubmit((texts) => {
		const name = texts.name.trim();
		const description = texts.description.trim();

		mutate((data) => {
			if (board) {
				const entry = data.boards.find((item) => item.id === board.id);

				if (entry) {
					entry.name = name;
					entry.description = description;
				}
			} else {
				data.boards.push({ id: crypto.randomUUID(), name, description, tickets: [] });
			}
		});
		onDone();
	});

	const handleSubmit = (event: SubmitEvent<HTMLFormElement>) => void save(event);

	const validateName = (value: string) => value.trim() !== "" || t("nameRequired");

	let submit = (
		<>
			<PlusIcon size={16} style={{ flexShrink: 0 }} />
			<Text size="2" wrap="nowrap">
				{t("createBoard")}
			</Text>
		</>
	);

	if (board) submit = <Text size="2">{t("saveChanges")}</Text>;

	return (
		<form noValidate onSubmit={handleSubmit}>
			<Flex direction="column" gap="4" mt="4">
				<Field label={t("boardName")} error={error}>
					<TextField.Root autoFocus {...form.register("name", { validate: validateName })} />
				</Field>
				<Field label={t("description")}>
					<TextArea
						rows={3}
						placeholder={t("boardDescriptionPlaceholder")}
						style={{ height: 72 }}
						{...form.register("description")}
					/>
				</Field>
			</Flex>
			<Grid columns={{ initial: "2", md: "auto auto" }} justify={{ md: "end" }} gap="3" mt="5">
				<Dialog.Close>
					<Button type="button" size={{ initial: "4", md: "2" }} variant="soft" color="gray">
						<Text size="2">{t("cancel")}</Text>
					</Button>
				</Dialog.Close>
				<Button type="submit" size={{ initial: "4", md: "2" }}>
					{submit}
				</Button>
			</Grid>
		</form>
	);
};
