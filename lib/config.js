export const DEFAULT_SETTINGS = Object.freeze({
  url: "",
  timezoneId: "America/New_York",
  language: "en-US"
});

export function normalizeUrl(rawValue) {
  const value = String(rawValue ?? "").trim();
  if (!value) {
    throw new Error("请输入要打开的网站地址。");
  }

  const withProtocol = /^[a-z][a-z\d+.-]*:/i.test(value)
    ? value
    : `https://${value}`;

  let parsed;
  try {
    parsed = new URL(withProtocol);
  } catch {
    throw new Error("网站地址格式不正确。");
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error("只允许打开 HTTP 或 HTTPS 网站。");
  }
  if (!parsed.hostname) {
    throw new Error("网站地址缺少有效域名。");
  }
  if (parsed.username || parsed.password) {
    throw new Error("请不要在网站地址中直接包含用户名或密码。");
  }

  return parsed.href;
}

export function normalizeLanguage(rawValue) {
  const value = String(rawValue ?? "").trim();
  if (!value) {
    throw new Error("请输入浏览器语言，例如 en-US。");
  }

  let canonical;
  try {
    [canonical] = Intl.getCanonicalLocales(value);
  } catch {
    throw new Error("浏览器语言不是有效的 BCP 47 标签，例如应填写 en-US 或 ja-JP。");
  }

  if (!canonical) {
    throw new Error("浏览器语言不能为空。");
  }
  return canonical;
}

export function normalizeTimezone(rawValue) {
  const value = String(rawValue ?? "").trim();
  if (!value) {
    throw new Error("请输入 IANA 时区，例如 America/New_York。");
  }

  try {
    return new Intl.DateTimeFormat("en-US", { timeZone: value })
      .resolvedOptions()
      .timeZone;
  } catch {
    throw new Error("时区名称无效，请使用 IANA 时区，例如 America/New_York。");
  }
}

export function toIcuLocale(language) {
  return normalizeLanguage(language).replaceAll("-", "_");
}

export function buildLanguageList(language) {
  const canonical = normalizeLanguage(language);
  const parts = canonical.split("-");
  const candidates = [canonical];

  if (parts.length > 2) {
    candidates.push(parts.slice(0, -1).join("-"));
  }
  if (parts.length > 1) {
    candidates.push(parts[0]);
  }

  return [...new Set(candidates)];
}

export function buildAcceptLanguage(language) {
  return buildLanguageList(language)
    .map((item, index) => index === 0 ? item : `${item};q=${(1 - index / 10).toFixed(1)}`)
    .join(",");
}

export function normalizeConfig(rawConfig) {
  const language = normalizeLanguage(rawConfig?.language);
  return Object.freeze({
    url: normalizeUrl(rawConfig?.url),
    timezoneId: normalizeTimezone(rawConfig?.timezoneId),
    language,
    languages: Object.freeze(buildLanguageList(language)),
    locale: toIcuLocale(language),
    acceptLanguage: buildAcceptLanguage(language)
  });
}
