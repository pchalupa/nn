import { tv } from "tailwind-variants";

export const classNames = tv({
	slots: {
		label: "flex flex-col gap-y-1 text-xs font-medium text-zinc-400 uppercase",
		textArea: "min-h-32 rounded bg-zinc-700 px-2 py-1 text-sm text-zinc-200 normal-case",
	},
});
