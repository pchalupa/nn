import { tv } from "tailwind-variants";

export const classNames = tv({
	slots: {
		base: "flex flex-col gap-1.5",
		label: "text-xs font-medium text-fg-muted",
		hint: "text-xs text-fg-subtle",
	},
	variants: {
		caption: {
			true: { base: "gap-2", label: "tracking-wider text-fg-subtle uppercase" },
		},
	},
});
