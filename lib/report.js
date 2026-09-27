import { evaluateInspection } from "./inspection.js";

export const REPORT_SCHEMA_VERSION = 1;

export function redactUrl(rawUrl) {
  try {
    const parsed = new URL(rawUrl);
    return `${parsed.origin}/`;
  } catch {
    return "unavailable";
  }
}

export function createDiagnosticsReport(results, metadata = {}) {
  const environments = results.map((result) => {
    const evaluation = evaluateInspection(result.expected, result.actual);
    return {
      windowId: result.session?.windowId ?? null,
      urlOrigin: redactUrl(result.session?.url),
      expected: {
        languages: result.expected.languages,
        locale: result.expected.language,
        timezoneId: result.expected.timezoneId,
        acceptLanguage: result.expected.acceptLanguage
      },
      actual: result.actual,
      session: {
        status: result.session?.status ?? "unknown",
        controlledTabCount: result.session?.controlledTabCount ?? null,
        untrustedTabCount: result.session?.untrustedTabCount ?? null,
        protectedChildTargets: result.session?.protectedChildTargets ?? 0,
        lastVerifiedAt: result.session?.lastVerifiedAt ?? null
      },
      evaluation
    };
  });
  return {
    kind: "dedicated-locale-tab/diagnostics",
    schemaVersion: REPORT_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    extensionVersion: metadata.extensionVersion ?? "unknown",
    browser: metadata.browser ?? "Chromium",
    privacy: "URLs are reduced to origins; cookies, login state, full IP addresses, and browsing history are not included.",
    environments
  };
}

export function formatDiagnosticsMarkdown(report) {
  const lines = [
    "# Dedicated Locale Tab diagnostics",
    "",
    `- Generated: ${report.generatedAt}`,
    `- Extension: ${report.extensionVersion}`,
    `- Browser: ${report.browser}`,
    `- Environments: ${report.environments.length}`,
    "",
    "| URL origin | Languages | Timezone | Status | Tabs | Child targets |",
    "| --- | --- | --- | --- | ---: | ---: |"
  ];
  for (const environment of report.environments) {
    lines.push(
      `| ${environment.urlOrigin} | ${environment.expected.languages.join(", ")} | `
      + `${environment.expected.timezoneId} | ${environment.evaluation.status} | `
      + `${environment.session.controlledTabCount ?? "?"} | `
      + `${environment.session.protectedChildTargets} |`
    );
  }
  lines.push("", "## Detailed checks", "");
  report.environments.forEach((environment, index) => {
    lines.push(`### Environment ${index + 1}: ${environment.urlOrigin}`, "");
    for (const [name, check] of Object.entries(environment.evaluation.details)) {
      lines.push(
        `- **${name}**: ${check.status}; expected=${JSON.stringify(check.expected)}; `
        + `actual=${JSON.stringify(check.actual)}${check.note ? `; ${check.note}` : ""}`
      );
    }
    lines.push("");
  });
  lines.push(
    "## Scope", "",
    "This report covers browser locale, language negotiation, and timezone behavior. ",
    "IP routing, VPN state, DNS, WebRTC, cookies, account region, fonts, canvas, and hardware characteristics are outside scope."
  );
  return lines.join("\n");
}
