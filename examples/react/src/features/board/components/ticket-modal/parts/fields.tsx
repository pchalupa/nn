import { Box, Flex, Grid, Select, Separator, TextArea, TextField } from "@radix-ui/themes";
import { type Link, type Status as TicketStatus, status } from "example-schema";
import type { ReactNode } from "react";
import { type UseFormReturn, useFormState } from "react-hook-form";
import { useTranslation } from "react-i18next";

import { Caption } from "@/components/caption";
import { Field } from "@/components/field";
import { PersonAvatar } from "@/components/person-avatar";
import { Status } from "@/features/board/components/status";
import { addLabel, withoutLabel } from "@/features/board/labels";
import { useQuery } from "@/store";

import { AssigneeOption } from "./assignee-option";
import { LabelInput } from "./label-input";
import { Links } from "./links";

/** Ticket fields the modal edits. */
export interface TicketDraft {
	title: string;
	description: string;
	status: TicketStatus;
	assignee: string;
	labels: string[];
}

/** Ticket fields edited as text and saved on blur. */
export type TextFieldName = "title" | "description";

/** Ticket fields that change through a control and save at once. */
export type TicketProperties = Pick<TicketDraft, "status" | "assignee" | "labels">;

/** Writes new values of some ticket properties. */
export type PropertyChange = (patch: Partial<TicketProperties>) => void;

const unassigned = "unassigned";

interface TicketFieldsProps {
	form: UseFormReturn<TicketDraft>;
	properties: TicketProperties;
	onChange: PropertyChange;
	onTextBlur?: (name: TextFieldName) => void;
	links: readonly Link[];
	onAddLink: (link: Link) => void;
	onRemoveLink: (id: string) => void;
	autoFocus?: boolean;
	children?: ReactNode;
}

/** Renders the editable ticket in reading order (title, property controls and links, then description and extra content), beside each other from `md` up and in one column below it. */
export const TicketFields = ({
	form,
	properties,
	onChange,
	onTextBlur,
	links,
	onAddLink,
	onRemoveLink,
	autoFocus = false,
	children,
}: TicketFieldsProps) => {
	const { t } = useTranslation();
	const users = useQuery((data) =>
		data.users.map((user) => ({ id: user.id, name: user.name, passkeys: user.passkeys })),
	);
	const { errors } = useFormState({ control: form.control, name: "title" });
	let titleError: string | undefined;

	if (errors.title) titleError = t("titleRequired");

	const handleStatusChange = (value: string) => {
		const nextStatus = status.literals.find((option) => option === value);

		if (nextStatus) onChange({ status: nextStatus });
	};

	const handleAssigneeChange = (value: string) => {
		if (value === unassigned) {
			onChange({ assignee: "" });
		} else {
			onChange({ assignee: value });
		}
	};

	const handleAddLabel = (label: string) => {
		const labels = [...properties.labels];

		addLabel(labels, label);
		onChange({ labels });
	};

	const handleRemoveLabel = (label: string) => onChange({ labels: withoutLabel(properties.labels, label) });

	return (
		<Grid
			areas={{ initial: '"title" "details" "body"', md: '"title sep details" "body sep details"' }}
			columns={{ initial: "1", md: "minmax(0, 1fr) auto 360px" }}
			rows={{ initial: "auto auto 1fr", md: "auto 1fr" }}
			gapY={{ initial: "5", md: "0" }}
			p={{ initial: "4", md: "0" }}
			flexGrow={{ initial: "1", md: "0" }}
			height={{ initial: "auto", md: "640px" }}
			minHeight="0"
			overflowY={{ initial: "auto", md: "visible" }}
		>
			<Box gridArea="title" pt={{ initial: "0", md: "5" }} px={{ initial: "0", md: "5" }}>
				<Field label={<Caption>{t("title")}</Caption>} gap="2" error={titleError}>
					<TextField.Root
						size="3"
						autoFocus={autoFocus}
						{...form.register("title", {
							validate: (value) => value.trim() !== "",
							onBlur: () => onTextBlur?.("title"),
						})}
					/>
				</Field>
			</Box>
			<Flex
				gridArea="details"
				direction="column"
				gap={{ initial: "5", md: "4" }}
				p={{ initial: "0", md: "5" }}
				overflowY={{ initial: "visible", md: "auto" }}
			>
				<Select.Root value={properties.status} onValueChange={handleStatusChange}>
					<Field label={<Caption>{t("status")}</Caption>} gap="2">
						<Select.Trigger radius="large" />
					</Field>
					<Select.Content>
						{status.literals.map((option) => (
							<Select.Item key={option} value={option}>
								<Status status={option} />
							</Select.Item>
						))}
					</Select.Content>
				</Select.Root>
				<Select.Root value={properties.assignee || unassigned} onValueChange={handleAssigneeChange}>
					<Field label={<Caption>{t("assignee")}</Caption>} gap="2">
						<Select.Trigger radius="large" />
					</Field>
					<Select.Content>
						<Select.Item value={unassigned}>
							<AssigneeOption avatar={<PersonAvatar />} name={t("unassigned")} />
						</Select.Item>
						{users.map((user) => (
							<Select.Item key={user.id} value={user.id}>
								<AssigneeOption avatar={<PersonAvatar user={user} />} name={user.name} />
							</Select.Item>
						))}
					</Select.Content>
				</Select.Root>
				<LabelInput labels={properties.labels} onAdd={handleAddLabel} onRemove={handleRemoveLabel} />
				<Links links={links} onAdd={onAddLink} onRemove={onRemoveLink} />
			</Flex>
			<Flex
				gridArea="body"
				direction="column"
				gap="5"
				p={{ initial: "0", md: "5" }}
				overflowY={{ initial: "visible", md: "auto" }}
			>
				<Field label={<Caption>{t("description")}</Caption>} gap="2" flexGrow="1" minHeight="200px">
					<Flex asChild direction="column" flexGrow="1">
						<TextArea
							resize="none"
							radius="large"
							style={{
								padding:
									"calc(var(--space-3) - var(--space-1) * 1.5 + 1px) calc(var(--space-3) - var(--space-2) + 1px)",
								backgroundClip: "border-box",
							}}
							{...form.register("description", { onBlur: () => onTextBlur?.("description") })}
						/>
					</Flex>
				</Field>
				{children}
			</Flex>
			<Box gridArea="sep" display={{ initial: "none", md: "block" }}>
				<Separator orientation="vertical" size="4" color="gray" />
			</Box>
		</Grid>
	);
};
