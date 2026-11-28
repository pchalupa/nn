import { benchmarkPlugin } from "@goodstate/test-config/vitest/plugins";
import { defineProject, type UserWorkspaceConfig } from "vitest/config";

const config: UserWorkspaceConfig = defineProject({
	plugins: [benchmarkPlugin()],
});

export default config;
