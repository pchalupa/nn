import { benchmarkPlugin } from "@nn/test-config/vitest";
import { defineProject } from "vitest/config";

export default defineProject({
	plugins: [benchmarkPlugin()],
});
