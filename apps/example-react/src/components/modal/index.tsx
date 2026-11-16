import { type MouseEvent, type ReactNode, type Ref, useImperativeHandle, useRef } from "react";

export interface ModalHandle {
	open: () => void;
	close: () => void;
}

interface ModalProps {
	ref?: Ref<ModalHandle>;
	role?: "dialog" | "alertdialog";
	className?: string;
	onClose: () => void;
	children: ReactNode;
}

export const Modal = ({ ref, role, className = "w-230", onClose, children }: ModalProps) => {
	const dialogRef = useRef<HTMLDialogElement>(null);
	const pressedBackdrop = useRef(false);

	useImperativeHandle(ref, () => ({
		open: () => dialogRef.current?.showModal(),
		close: () => dialogRef.current?.close(),
	}));

	const handleMouseDown = (event: MouseEvent) => {
		pressedBackdrop.current = event.target === event.currentTarget;
	};

	const handleBackdropClick = (event: MouseEvent) => {
		if (pressedBackdrop.current && event.target === event.currentTarget) dialogRef.current?.close();
	};

	return (
		<dialog
			ref={dialogRef}
			role={role}
			className={`m-auto max-h-[calc(100dvh-2rem)] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-xl border border-line bg-overlay p-0 text-fg shadow-overlay backdrop:bg-canvas/70 open:flex ${className}`}
			onClose={(event) => {
				if (event.target === event.currentTarget) onClose();
			}}
			onMouseDown={handleMouseDown}
			onClick={handleBackdropClick}
		>
			{children}
		</dialog>
	);
};
