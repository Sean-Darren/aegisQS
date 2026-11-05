import en from "../messages/en.json";
import zh from "../messages/zh-HK.json";
export function translator(locale: "en" | "zh-HK") {
  return (key: keyof typeof en, values: Record<string, string | number> = {}) =>
    Object.entries(values).reduce(
      (text, [name, value]) => text.replaceAll(`{${name}}`, String(value)),
      (locale === "zh-HK" ? zh : en)[key],
    );
}
