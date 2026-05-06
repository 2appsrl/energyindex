export const locales = ["it"] as const;
export const defaultLocale = "it" as const;
export type Locale = (typeof locales)[number];
