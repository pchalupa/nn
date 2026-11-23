import { IconBase, type IconProps, type IconWeight } from "@phosphor-icons/react";
import type { ReactElement } from "react";

const center = 128;
const radius = 96;
const dots = Array.from({ length: 8 }, (_, index) => {
	const angle = (index * Math.PI) / 4;

	return { x: center + radius * Math.cos(angle), y: center + radius * Math.sin(angle) };
});

const weights = new Map<IconWeight, ReactElement>([
	[
		"regular",
		<>
			{dots.map((dot) => (
				<circle key={`${dot.x},${dot.y}`} cx={dot.x} cy={dot.y} r="12" />
			))}
		</>,
	],
]);

/** Renders a dotted circle in the Phosphor icon style, which Phosphor itself does not ship. */
export const CircleDottedIcon = (props: IconProps) => <IconBase {...props} weights={weights} />;
