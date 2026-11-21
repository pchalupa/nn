import { Box, Button, Dialog, Flex, Select, TextArea, TextField, VisuallyHidden } from "@radix-ui/themes";
import { type Comment, type Status, status } from "example-schema";
import { Controller, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";

import { statusLabels } from "../../i18n";
import { useQuery, useMutation } from "../../store";
import { Field } from "../field";
import { Comments } from "./comments";

interface TicketModalProps {
	id?: string;
	onClose: () => void;
}

interface TicketDraft {
	title: string;
	description: string;
	status: Status;
	assignee: string;
	comments: Comment[];
}

const newTicket: TicketDraft = { title: "", description: "", status: "todo", assignee: "", comments: [] };

const unassigned = "unassigned";

export const TicketModal = ({ id, onClose }: TicketModalProps) => {
	const { t } = useTranslation();
	const ticket = useQuery((data) => {
		const selectedTicket = data.tickets.find((entry) => entry.id === id);

		if (selectedTicket) {
			return {
				title: selectedTicket.title,
				description: selectedTicket.description,
				status: selectedTicket.status,
				assignee: selectedTicket.assignee,
				comments: selectedTicket.comments.map((comment) => ({
					...comment,
					createdAt: new Date(comment.createdAt).toLocaleDateString(),
				})),
			};
		}
	});
	const users = useQuery((data) => data.users.map((user) => ({ id: user.id, name: user.name })));
	const mutate = useMutation();
	const form = useForm<TicketDraft>({
		defaultValues: newTicket,
		values: ticket,
		resetOptions: { keepDirtyValues: true },
	});

	const handleOpenChange = (open: boolean) => {
		if (!open) onClose();
	};

	const handleSubmit = form.handleSubmit((draft) => {
		const title = draft.title.trim();

		if (!ticket) {
			mutate((data) => {
				data.tickets.push({ ...draft, id: crypto.randomUUID(), title, comments: [] });
			});
		} else {
			mutate((data) => {
				const item = data.tickets.find((entry) => entry.id === id);

				if (item) {
					item.title = title;
					item.description = draft.description;
					item.status = draft.status;
					item.assignee = draft.assignee;
				}
			});
		}

		onClose();
	});

	const handleDelete = () => {
		mutate((data) => {
			data.tickets = data.tickets.filter((entry) => entry.id !== id);
		});

		onClose();
	};

	return (
		<Dialog.Root open onOpenChange={handleOpenChange}>
			<Dialog.Content maxWidth="768px" aria-describedby={undefined}>
				<VisuallyHidden>
					<Dialog.Title>{ticket?.title || t("create")}</Dialog.Title>
				</VisuallyHidden>
				<form noValidate onSubmit={handleSubmit}>
					<Flex direction="column" gap="6">
						<Flex direction={{ initial: "column", md: "row" }} gap="6">
							<Flex direction="column" gap="4" flexGrow="1">
								<Field label={t("title")}>
									<TextField.Root size="3" {...form.register("title", { validate: (value) => value.trim() !== "" })} />
								</Field>
								<Field label={t("description")}>
									<TextArea rows={5} resize="vertical" {...form.register("description")} />
								</Field>
							</Flex>
							<Box
								p="4"
								width={{ initial: "100%", md: "256px" }}
								flexShrink="0"
								style={{ backgroundColor: "var(--gray-a2)", borderRadius: "var(--radius-3)" }}
							>
								<Flex direction="column" gap="4">
									<Field label={t("status")}>
										<Controller
											control={form.control}
											name="status"
											render={({ field }) => (
												<Select.Root
													value={field.value}
													onValueChange={(value) => {
														const nextStatus = status.literals.find((option) => option === value);

														if (nextStatus) field.onChange(nextStatus);
													}}
												>
													<Select.Trigger ref={field.ref} />
													<Select.Content>
														{status.literals.map((option) => (
															<Select.Item key={option} value={option}>
																{t(statusLabels[option])}
															</Select.Item>
														))}
													</Select.Content>
												</Select.Root>
											)}
										/>
									</Field>
									<Field label={t("assignee")}>
										<Controller
											control={form.control}
											name="assignee"
											render={({ field }) => (
												<Select.Root
													value={field.value || unassigned}
													onValueChange={(value) => {
														if (value === unassigned) {
															field.onChange("");
														} else {
															field.onChange(value);
														}
													}}
												>
													<Select.Trigger ref={field.ref} />
													<Select.Content>
														<Select.Item value={unassigned}>{t("unassigned")}</Select.Item>
														{users.map((user) => (
															<Select.Item key={user.id} value={user.id}>
																{user.name}
															</Select.Item>
														))}
													</Select.Content>
												</Select.Root>
											)}
										/>
									</Field>
								</Flex>
							</Box>
						</Flex>
						<Flex justify="end" gap="2">
							{ticket && (
								<Button type="button" variant="soft" color="gray" onClick={handleDelete}>
									{t("delete")}
								</Button>
							)}
							<Button type="submit">{t("save")}</Button>
						</Flex>
					</Flex>
				</form>
				<Comments comments={ticket?.comments} />
			</Dialog.Content>
		</Dialog.Root>
	);
};
