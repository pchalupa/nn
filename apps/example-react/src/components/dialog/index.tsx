import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "../button";
import { Modal, type ModalHandle } from "../modal";

interface DialogProps {
	title: string;
	body: string;
	confirmLabel: string;
	onConfirm: () => void;
	onCancel: () => void;
}

export const Dialog = ({ title, body, confirmLabel, onConfirm, onCancel }: DialogProps) => {
	const { t } = useTranslation();
	const modalRef = useRef<ModalHandle>(null);

	useEffect(() => modalRef.current?.open(), []);

	return (
		<Modal ref={modalRef} role="alertdialog" className="w-100" onClose={onCancel}>
			<div className="flex flex-col gap-2 p-5">
				<h2 className="text-base font-semibold text-fg">{title}</h2>
				<p className="text-sm text-fg-muted">{body}</p>
			</div>
			<div className="flex justify-end gap-2 border-t border-line-subtle bg-white/2 px-5 py-3">
				<Button variant="secondary" onClick={onCancel}>
					{t("cancel")}
				</Button>
				<Button variant="danger" onClick={onConfirm}>
					{confirmLabel}
				</Button>
			</div>
		</Modal>
	);
};
