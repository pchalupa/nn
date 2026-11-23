import { Box, Flex } from "@radix-ui/themes";

import { colorFor } from "@/modules/color/label-color";

interface LabelDotProps {
	name: string;
}

/** Renders a small dot in the color of a label. */
export const LabelDot = ({ name }: LabelDotProps) => (
	<Flex width="16px" justify="center" flexShrink="0">
		<Box width="8px" height="8px" style={{ borderRadius: "50%", background: `var(--${colorFor(name)}-11)` }} />
	</Flex>
);
