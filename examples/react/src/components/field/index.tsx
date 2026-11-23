import { Flex, type FlexProps, Slot, Text } from "@radix-ui/themes";
import { type ReactNode, useId } from "react";

type FieldProps = Pick<FlexProps, "flexGrow" | "minHeight"> & {
	label: ReactNode;
	hint?: string;
	error?: string;
	gap?: "1" | "2";
	children: ReactNode;
};

/** Renders a labelled form control with an optional hint and error that describe it. */
export const Field = ({ label, hint, error, gap = "1", children, ...layout }: FieldProps) => {
	const controlId = useId();
	const hintId = useId();
	const errorId = useId();
	const descriptions: string[] = [];
	let invalid: true | undefined;

	if (hint) descriptions.push(hintId);

	if (error) {
		descriptions.push(errorId);
		invalid = true;
	}

	let describedBy: string | undefined;

	if (descriptions.length > 0) describedBy = descriptions.join(" ");

	return (
		<Flex direction="column" gap={gap} {...layout}>
			<Text as="label" htmlFor={controlId} size="1" weight="medium" color="gray">
				{label}
			</Text>
			<Slot id={controlId} aria-describedby={describedBy} aria-invalid={invalid}>
				{children}
			</Slot>
			{hint && (
				<Text id={hintId} size="1" color="gray">
					{hint}
				</Text>
			)}
			{error && (
				<Text id={errorId} size="1" color="red">
					{error}
				</Text>
			)}
		</Flex>
	);
};
