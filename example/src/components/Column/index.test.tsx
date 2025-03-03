import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { Column } from ".";

describe("Column", () => {
	const user = userEvent.setup();
	const setup = () => {
		const title = "Test";
		const status = "todo";

		render(<Column title={title} status={status} />);

		return { title, status };
	};

	it("should render without issues", () => {
		const { title } = setup();

		expect(screen.getByText(title)).toBeTruthy();
		expect(screen.getByRole("button")).toBeTruthy();
	});

	it("should add a ticket", async () => {
		setup();

		await act(() => user.click(screen.getByRole("button")));

		expect(screen.getByText("todo")).toBeTruthy();
	});
});
