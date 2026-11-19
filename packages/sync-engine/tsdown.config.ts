import { libraryConfig, type UserConfig } from "@nn/build-config/tsdown";

const config: UserConfig = libraryConfig({
	index: "src/sync-engine.ts",
	replica: "src/replica.ts",
});

export default config;
