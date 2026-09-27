export const TAB_STATUS = Object.freeze({
  ATTACHING: "attaching",
  APPLYING: "applying",
  HEALTHY: "healthy",
  DEGRADED: "degraded",
  BLOCKED_BY_POLICY: "blocked-by-policy",
  DETACHED: "detached",
  CLOSING: "closing",
  CLOSE_FAILED: "close-failed"
});

const HEALTH_PRIORITY = Object.freeze({
  [TAB_STATUS.HEALTHY]: 0,
  [TAB_STATUS.ATTACHING]: 1,
  [TAB_STATUS.APPLYING]: 1,
  [TAB_STATUS.DEGRADED]: 2,
  [TAB_STATUS.BLOCKED_BY_POLICY]: 3,
  [TAB_STATUS.DETACHED]: 3,
  [TAB_STATUS.CLOSING]: 3,
  [TAB_STATUS.CLOSE_FAILED]: 4
});

export function errorText(error) {
  if (error instanceof Error && error.message) return error.message;
  return String(error ?? "未知错误");
}

export function classifyDebuggerError(error) {
  const message = errorText(error);
  if (
    message.includes("Host access is restricted by policy")
    || message.includes("Screenshot capture is restricted by policy")
  ) {
    return Object.freeze({
      code: "enterprise-policy",
      status: TAB_STATUS.BLOCKED_BY_POLICY,
      message: `调试器被浏览器企业策略阻止：${message}`
    });
  }
  if (
    message.includes("Another debugger is already attached")
    || message.includes("Cannot attach to this target")
  ) {
    return Object.freeze({
      code: "debugger-busy",
      status: TAB_STATUS.DETACHED,
      message: "该页面已被其他调试器占用。请关闭页面开发者工具后重试。"
    });
  }
  return Object.freeze({ code: "debugger-error", status: TAB_STATUS.DEGRADED, message });
}

export function summarizeHealth(statuses) {
  if (!statuses.length) return TAB_STATUS.DEGRADED;
  return statuses.reduce((worst, current) => (
    (HEALTH_PRIORITY[current] ?? 2) > (HEALTH_PRIORITY[worst] ?? 2)
      ? current : worst
  ), statuses[0]);
}

export function findHeader(headers, name) {
  const expected = String(name).toLowerCase();
  for (const [key, value] of Object.entries(headers ?? {})) {
    if (key.toLowerCase() === expected) return String(value);
  }
  return null;
}
