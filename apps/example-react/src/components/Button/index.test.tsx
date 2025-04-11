import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Button, type ButtonProps } from ".";

describe("Button", () => {
	const setup = (props: ButtonProps) => {
		render(<Button {...props} />);

		return props;
	};

	it("should render correctly", () => {
		const { text } = setup({ text: "Test" });

		expect(screen.getByText(text)).toBeTruthy();
		expect(screen.getByRole("button")).toBeTruthy();
	});

	it("should call onClick when clicked", async () => {
		const onClick = vi.fn();
		const { text } = setup({ text: "Test", onClick });

		await userEvent.click(screen.getByText(text));

		expect(onClick).toHaveBeenCalled();
	});
});
