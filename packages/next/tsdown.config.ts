import { reactLibraryConfig } from "@nn/build-config/react-tsdown";

export default reactLibraryConfig({
	index: "src/next.ts",
	server: "src/server.ts",
	config: "src/config.ts",
});
