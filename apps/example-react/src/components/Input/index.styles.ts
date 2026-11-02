import { tv, type VariantProps } from "tailwind-variants";

export type InputStyleVariants = VariantProps<typeof classNames>;

export const classNames = tv({
	slots: {
		label: "flex flex-col gap-y-1 text-xs font-medium text-zinc-400 uppercase",
		input: "rounded bg-zinc-700 px-2 py-1 text-zinc-200 normal-case",
	},
	variants: {
		size: {
			md: { input: "text-sm" },
			lg: { input: "text-xl font-semibold" },
		},
	},
	defaultVariants: {
		size: "md",
	},
});
