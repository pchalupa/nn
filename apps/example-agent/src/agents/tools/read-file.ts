import { readFile as readTextFile } from "node:fs/promises";
import { join } from "node:path";

import { jsonSchema, tool } from "ai";

import { getRepositoryFiles, getRepositoryRoot } from "../../modules/repository";

export const readFile = tool({
	description:
		"Read a UTF-8 text file from the project repository. Use findFile first when you do not know the full path.",
	inputSchema: jsonSchema<{ path: string }>({
		type: "object",
		properties: {
			path: {
				type: "string",
				description: "The path relative to the repository root, such as packages/store/src/store.ts.",
			},
		},
		required: ["path"],
		additionalProperties: false,
	}),
	execute: async ({ path }) => {
		const root = await getRepositoryRoot();
		const files = await getRepositoryFiles();

		if (!files.includes(path)) {
			throw new Error(`${path} is not a repository file. Use findFile to look up its full path.`);
		}

		return readTextFile(join(root, path), "utf8");
	},
});
