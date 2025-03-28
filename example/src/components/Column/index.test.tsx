import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Suspense } from "react";
import { describe, expect, it } from "vitest";
import { Column } from ".";

describe("Column", () => {
	const user = userEvent.setup();
	const setup = () => {
		const title = "Test";
		const status = "todo";

		render(
			<Suspense fallback={"loading"}>
				<Column title={title} status={status} />
			</Suspense>,
		);

		return { title, status };
	};

	it("should render without issues", async () => {
		const { title } = await act(async () => setup());

		expect(screen.getByText(title)).toBeTruthy();
		expect(screen.getByRole("button")).toBeTruthy();
	});

	it("should add a ticket", async () => {
		await act(async () => setup());

		await act(() => user.click(screen.getByRole("button")));

		expect(screen.getByText("todo")).toBeTruthy();
	});

	it("should add 10 tickets", async () => {
		await act(async () => setup());

		for (let i = 1; i < 10; i++) {
			await act(() => user.click(screen.getByRole("button")));
		}

		expect(screen.getAllByText("todo")).toHaveLength(10);
	});
});
