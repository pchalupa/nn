import { type MouseEvent, type ReactNode, type Ref, useImperativeHandle, useRef } from "react";

export interface ModalHandle {
	open: () => void;
	close: () => void;
}

interface ModalProps {
	ref?: Ref<ModalHandle>;
	onClose: () => void;
	children: ReactNode;
}

export const Modal = ({ ref, onClose, children }: ModalProps) => {
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
			className="m-auto w-full max-w-3xl rounded-lg bg-zinc-800 p-0 text-zinc-200 backdrop:bg-black/60"
			onClose={onClose}
			onMouseDown={handleMouseDown}
			onClick={handleBackdropClick}
		>
			<div className="p-6">{children}</div>
		</dialog>
	);
};
