import { act, fireEvent, render, screen } from "@testing-library/react";
import { createRef } from "react";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { Modal, type ModalHandle } from ".";

describe("Modal", () => {
	beforeAll(() => {
		HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
			this.open = true;
		};
		HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
			this.open = false;
			this.dispatchEvent(new Event("close"));
		};
	});

	const setup = () => {
		const ref = createRef<ModalHandle>();
		const onClose = vi.fn();

		render(
			<Modal ref={ref} onClose={onClose}>
				<p>Content</p>
			</Modal>,
		);

		return { ref, onClose, dialog: screen.getByRole("dialog", { hidden: true }) };
	};

	it("stays closed until opened", () => {
		const { dialog } = setup();

		expect(dialog).toHaveProperty("open", false);
	});

	it("opens on demand", () => {
		const { ref, dialog } = setup();

		act(() => ref.current?.open());

		expect(dialog).toHaveProperty("open", true);
	});

	it("closes on demand and reports it", () => {
		const { ref, onClose, dialog } = setup();

		act(() => ref.current?.open());
		act(() => ref.current?.close());

		expect(dialog).toHaveProperty("open", false);
		expect(onClose).toHaveBeenCalledOnce();
	});

	it("closes when the backdrop is clicked", () => {
		const { ref, onClose, dialog } = setup();

		act(() => ref.current?.open());
		fireEvent.mouseDown(dialog);
		fireEvent.click(dialog);

		expect(dialog).toHaveProperty("open", false);
		expect(onClose).toHaveBeenCalledOnce();
	});

	it("stays open when a press inside ends on the backdrop", () => {
		const { ref, onClose, dialog } = setup();

		act(() => ref.current?.open());
		fireEvent.mouseDown(screen.getByText("Content"));
		fireEvent.click(dialog);

		expect(dialog).toHaveProperty("open", true);
		expect(onClose).not.toHaveBeenCalled();
	});
});
