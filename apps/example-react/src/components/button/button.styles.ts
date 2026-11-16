import { tv, type VariantProps } from "tailwind-variants";

export type ButtonStyleVariants = VariantProps<typeof classNames>;

export const classNames = tv({
	slots: {
		base: "inline-flex shrink-0 items-center gap-1.5 rounded-md text-sm font-medium whitespace-nowrap focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-50",
		icon: "size-3.5",
	},
	variants: {
		variant: {
			primary: { base: "bg-fg text-fg-inverse" },
			secondary: { base: "border border-line bg-card text-fg hover:bg-card-hover" },
			ghost: { base: "text-fg-muted hover:bg-selected" },
			danger: { base: "bg-danger-soft text-danger" },
		},
		size: {
			default: { base: "h-7.5 px-3" },
			compact: { base: "h-6.5 px-2" },
			full: { base: "h-9 w-full justify-center px-3" },
		},
	},
	defaultVariants: {
		variant: "primary",
		size: "default",
	},
});
