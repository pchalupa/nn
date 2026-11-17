import { benchmarkPlugin } from "@nn/test-config/vitest/plugins";
import { defineProject } from "vitest/config";

export default defineProject({
	plugins: [benchmarkPlugin()],
});
