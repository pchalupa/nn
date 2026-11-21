import { jsonSchema, tool } from "ai";

import { getRepositoryFiles } from "../../modules/repository";

export const findFile = tool({
	description:
		"Find files in the project repository whose path equals or ends with the given path, and return their paths relative to the repository root.",
	inputSchema: jsonSchema<{ path: string }>({
		type: "object",
		properties: {
			path: {
				type: "string",
				description: "A full or trailing part of a file path, such as store.ts or src/store.ts.",
			},
		},
		required: ["path"],
		additionalProperties: false,
	}),
	execute: async ({ path }) => {
		const target = path.replace(/:\d+(:\d+)?$/, "");
		const files = await getRepositoryFiles();

		if (files.includes(target)) return [target];

		return files.filter((file) => file.endsWith(`/${target}`));
	},
});
