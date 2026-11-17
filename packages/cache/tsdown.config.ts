import { libraryConfig, type UserConfig } from "@nn/build-config/tsdown";

const config: UserConfig = libraryConfig({
	"invalidatable-cache": "src/invalidatable-cache.ts",
	"versioned-cache": "src/versioned-cache.ts",
});

export default config;
