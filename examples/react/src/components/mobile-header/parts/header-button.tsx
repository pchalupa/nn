import { IconButton } from "@radix-ui/themes";
import type { ComponentProps } from "react";

type HeaderButtonProps = Omit<ComponentProps<typeof IconButton>, "size" | "variant" | "color" | "aria-label"> & {
	label: string;
};

/** Renders a 40px soft icon button for the mobile header, such as menu, back or copy link. */
export const HeaderButton = ({ label, ...button }: HeaderButtonProps) => (
	<IconButton type="button" size="3" variant="soft" color="gray" highContrast aria-label={label} {...button} />
);
