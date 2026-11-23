import { RobotIcon } from "@phosphor-icons/react";
import { Avatar } from "@radix-ui/themes";

import { colorFor } from "@/modules/color/label-color";
import { initials } from "@/modules/text/initials";

import type { AvatarSize } from "./avatar-size";
import { UnassignedAvatar } from "./parts/unassigned-avatar";

/** Describes the person fields an avatar needs. */
export interface Person {
	name: string;
	passkeys: readonly unknown[];
}

interface PersonAvatarProps {
	user?: Person;
	size?: AvatarSize;
}

/** Renders a person, agent or unassigned avatar, hidden from assistive tech because the name sits beside it. */
export const PersonAvatar = ({ user, size = "1" }: PersonAvatarProps) => {
	if (!user) return <UnassignedAvatar size={size} />;

	if (user.passkeys.length === 0) {
		return (
			<Avatar asChild size={size} variant="solid" fallback={<RobotIcon />}>
				<span aria-hidden />
			</Avatar>
		);
	}

	return (
		<Avatar asChild size={size} variant="soft" color={colorFor(user.name)} fallback={initials(user.name)}>
			<span aria-hidden />
		</Avatar>
	);
};
