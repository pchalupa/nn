import { libraryConfig } from "@nn/build-config/tsdown";

export default libraryConfig({
	entity: "src/entity.ts",
	codable: "src/codable.ts",
	codec: "src/codec.ts",
	"kinds/lww-register": "src/lww-register.ts",
	"kinds/lww-map": "src/lww-map.ts",
	"kinds/rga": "src/rga.ts",
});
