import { defaultClientConditions, defaultServerConditions, type UserConfig } from "vite";

const sourceCondition = "@nn/source";

export const sourceConditions: UserConfig = {
	resolve: { conditions: [sourceCondition, ...defaultClientConditions] },
	ssr: { resolve: { conditions: [sourceCondition, ...defaultServerConditions] } },
};
