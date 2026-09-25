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
			<Suspense fallback={"fallback"}>
				<Column title={title} status={status} />
			</Suspense>,
		);

		return { title, status };
	};

	it("should render without issues", async () => {
		const { title } = await act(async () => setup());

		expect(await screen.findByText(title)).toBeTruthy();
		expect(screen.getByRole("button")).toBeTruthy();
	});

	it("should add a ticket", async () => {
		await act(async () => setup());
		const button = await screen.findByRole("button");

		await act(() => user.click(button));

		expect(screen.getByText("todo")).toBeTruthy();
	});
});
