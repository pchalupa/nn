import { XIcon } from "@phosphor-icons/react";
import { Badge, IconButton } from "@radix-ui/themes";
import { useTranslation } from "react-i18next";

import { colorFor } from "../../../../modules/color/label-color";

interface LabelProps {
	name: string;
	onRemove?: () => void;
}

/** Renders a label as a colored soft badge, removable when onRemove is given. */
export const Label = ({ name, onRemove }: LabelProps) => {
	const { t } = useTranslation();
	const color = colorFor(name);

	return (
		<Badge variant="soft" size="1" color={color}>
			{name}
			{onRemove && (
				<IconButton
					type="button"
					size="1"
					variant="ghost"
					color={color}
					aria-label={t("removeLabel", { name })}
					onClick={onRemove}
				>
					<XIcon size={12} />
				</IconButton>
			)}
		</Badge>
	);
};
