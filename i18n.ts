import { getRequestConfig } from "next-intl/server";
import { defaultLocale, locales } from "./lib/i18n/config";

export default getRequestConfig(async ({ requestLocale }) => {
  let locale = await requestLocale;
  if (!locale || !locales.includes(locale as (typeof locales)[number])) {
    locale = defaultLocale;
  }
  return {
    locale,
    messages: {}, // v1 monolingual; messages will be added in v2 multilang
  };
});
