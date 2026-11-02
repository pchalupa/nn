import { useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";

import { statusLabels } from "../../i18n";
import { status, useRead, useUpdate } from "../../store";
import { Button } from "../Button";
import { Input } from "../Input";
import { Modal, type ModalHandle } from "../Modal";
import { TextArea } from "../TextArea";

interface TicketModalProps {
	id: string;
	onClose: () => void;
}

export const TicketModal = ({ id, onClose }: TicketModalProps) => {
	const { t } = useTranslation();
	const ticket = useRead((data) => {
		const selectedTicket = data.tickets.find((entry) => entry.id === id);

		if (selectedTicket) {
			return {
				title: selectedTicket.title,
				description: selectedTicket.description,
				status: selectedTicket.status,
				assignee: { name: selectedTicket.assignee.name, email: selectedTicket.assignee.email },
			};
		}
	});
	const updateStore = useUpdate();
	const modalRef = useRef<ModalHandle>(null);
	const form = useForm({ values: ticket, resetOptions: { keepDirtyValues: true } });

	useEffect(() => modalRef.current?.open(), []);

	const handleSubmit = form.handleSubmit((draft) => {
		updateStore((data) => {
			const item = data.tickets.find((entry) => entry.id === id);

			if (!item) return;

			item.title = draft.title.trim();
			item.description = draft.description;
			item.status = draft.status;
			item.assignee.name = draft.assignee.name;
			item.assignee.email = draft.assignee.email;
		});
	});

	if (!ticket) return null;

	return (
		<Modal ref={modalRef} onClose={onClose}>
			<form className="flex flex-col gap-y-6" noValidate onSubmit={handleSubmit}>
				<div className="flex flex-col gap-6 md:flex-row">
					<div className="flex flex-1 flex-col gap-y-4">
						<Input label={t("title")} size="lg" {...form.register("title")} />
						<TextArea label={t("description")} {...form.register("description")} />
					</div>
					<div className="flex w-full flex-col gap-y-4 rounded bg-zinc-900 p-4 md:w-64">
						<label className="flex flex-col gap-y-1 text-xs font-medium text-zinc-400 uppercase">
							{t("status")}
							<select
								className="rounded bg-zinc-700 px-2 py-1 text-sm text-zinc-200 normal-case"
								{...form.register("status")}
							>
								{status.literals.map((option) => (
									<option key={option} value={option}>
										{t(statusLabels[option])}
									</option>
								))}
							</select>
						</label>
						<Input label={t("name")} {...form.register("assignee.name")} />
						<Input label={t("email")} type="email" {...form.register("assignee.email")} />
					</div>
				</div>
				<div className="flex flex-row justify-end gap-x-2">
					<Button text={t("save")} type="submit" size="sm" />
				</div>
			</form>
		</Modal>
	);
};
