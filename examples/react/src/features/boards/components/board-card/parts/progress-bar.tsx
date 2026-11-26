import { Box, Flex } from "@radix-ui/themes";
import type { Status } from "example-schema";

interface ProgressBarProps {
	counts: Record<Status, number>;
}

const segments: ReadonlyArray<{ status: Status; color: string }> = [
	{ status: "backlog", color: "var(--gray-a5)" },
	{ status: "todo", color: "var(--gray-a8)" },
	{ status: "in-progress", color: "var(--blue-9)" },
	{ status: "done", color: "var(--green-9)" },
];

/** Renders a 6px bar split into one segment per status, sized by its ticket count, or a gray track for none. */
export const ProgressBar = ({ counts }: ProgressBarProps) => {
	const filled = segments.filter((segment) => counts[segment.status] > 0);

	return (
		<Flex gap="2px" height="6px" overflow="hidden" aria-hidden style={{ borderRadius: "var(--radius-1)" }}>
			{filled.length === 0 && <Box flexGrow="1" style={{ background: "var(--gray-a5)" }} />}
			{filled.map((segment) => (
				<Box
					key={segment.status}
					flexGrow={String(counts[segment.status])}
					flexBasis="0"
					style={{ background: segment.color }}
				/>
			))}
		</Flex>
	);
};
