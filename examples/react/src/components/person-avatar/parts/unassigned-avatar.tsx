import { UserIcon } from "@phosphor-icons/react";
import { Flex } from "@radix-ui/themes";

import type { AvatarSize } from "@/components/person-avatar/avatar-size";

const unassignedSizes = {
	"1": { box: "24px", icon: 14, radius: "var(--radius-2)" },
	"2": { box: "32px", icon: 18, radius: "var(--radius-2)" },
	"5": { box: "64px", icon: 32, radius: "var(--radius-4)" },
};

interface UnassignedAvatarProps {
	size: AvatarSize;
	label?: string;
}

/** Renders the outlined placeholder avatar for an unassigned ticket, named by `label` when no text sits beside it. */
export const UnassignedAvatar = ({ size, label }: UnassignedAvatarProps) => {
	const { box, icon, radius } = unassignedSizes[size];
	let role: "img" | undefined;
	let hidden: true | undefined = true;

	if (label !== undefined) {
		role = "img";
		hidden = undefined;
	}

	return (
		<Flex
			role={role}
			aria-label={label}
			aria-hidden={hidden}
			align="center"
			justify="center"
			width={box}
			height={box}
			flexShrink="0"
			style={{ borderRadius: radius, boxShadow: "inset 0 0 0 1px var(--gray-a7)" }}
		>
			<UserIcon size={icon} color="var(--gray-a11)" />
		</Flex>
	);
};
