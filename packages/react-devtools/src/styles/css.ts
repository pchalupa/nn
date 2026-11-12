const rules: string[] = [];

let styleSheet: CSSStyleSheet | undefined;

export const css = (strings: TemplateStringsArray, ...values: unknown[]): void => {
	rules.push(String.raw(strings, ...values));

	styleSheet?.replaceSync(rules.join(""));
};

export const getStyleSheet = () => {
	if (!styleSheet) {
		styleSheet = new CSSStyleSheet();
		styleSheet.replaceSync(rules.join(""));
	}

	return styleSheet;
};
