import test from "node:test";
import assert from "node:assert/strict";
import { TAB_STATUS, classifyDebuggerError, findHeader, summarizeHealth } from "../lib/session.js";

test("classifies debugger health and Chrome policy errors", () => {
  assert.equal(summarizeHealth([TAB_STATUS.HEALTHY, TAB_STATUS.DEGRADED]), TAB_STATUS.DEGRADED);
  assert.equal(classifyDebuggerError(new Error("Host access is restricted by policy")).code, "enterprise-policy");
  assert.equal(classifyDebuggerError(new Error("Another debugger is already attached")).code, "debugger-busy");
});

test("finds captured request headers case-insensitively", () => {
  assert.equal(findHeader({ "Accept-Language": "ja-JP" }, "accept-language"), "ja-JP");
  assert.equal(findHeader({ accept: "text/html" }, "accept-language"), null);
});
