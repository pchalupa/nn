const rules: string[] = [];

let styleSheet: CSSStyleSheet | undefined;

/** Adds rules to the shared devtools style sheet. Call it at module level next to the component. */
export const css = (strings: TemplateStringsArray, ...values: unknown[]): void => {
	rules.push(String.raw(strings, ...values));

	styleSheet?.replaceSync(rules.join(""));
};

export const getStyleSheet = (): CSSStyleSheet => {
	if (!styleSheet) {
		styleSheet = new CSSStyleSheet();
		styleSheet.replaceSync(rules.join(""));
	}

	return styleSheet;
};
