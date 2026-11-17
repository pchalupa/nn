import codspeedPlugin from "@codspeed/vitest-plugin";
import { defineProject } from "vitest/config";

export default defineProject({
	plugins: [codspeedPlugin()],
});
