import { sourceConditions } from "@nn/build-config/vite";
import { defineProject, mergeConfig } from "vitest/config";

export default mergeConfig(
	sourceConditions,
	defineProject({
		test: {
			setupFiles: ["fake-indexeddb/auto"],
		},
	}),
);
