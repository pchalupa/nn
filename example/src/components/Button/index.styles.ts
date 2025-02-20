import { type VariantProps, tv } from "tailwind-variants";

export type ButtonStyleVariants = VariantProps<typeof classNames>;

export const classNames = tv({
	base: "flex px-2 py-1 font-semibold shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2",
	variants: {
		color: {
			primary: "bg-indigo-600 text-white hover:bg-indigo-500 focus-visible:outline-indigo-600 active:bg-indigo-400",
			secondary:
				"bg-white text-gray-900 ring-1 ring-gray-300 ring-inset hover:bg-gray-100 focus-visible:outline-gray-900 active:bg-gray-200",
		},
		size: {
			sm: "text-sm",
			md: "text-base",
			lg: "px-4 py-3 text-lg",
		},
		rounded: {
			true: "rounded-full",
			false: "rounded",
		},
	},
	defaultVariants: {
		color: "primary",
		size: "md",
		rounded: false,
	},
});
