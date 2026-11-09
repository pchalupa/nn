import { readFile as readTextFile } from "node:fs/promises";

import { jsonSchema, tool } from "ai";

export const readFile = tool({
	description: "Read a UTF-8 text file. Relative paths are resolved from the agent process working directory.",
	inputSchema: jsonSchema<{ path: string }>({
		type: "object",
		properties: { path: { type: "string", description: "The absolute or relative path to the file." } },
		required: ["path"],
		additionalProperties: false,
	}),
	execute: ({ path }) => readTextFile(path, "utf8"),
});
