import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  allowOtpSend,
  allowOtpVerifyAttempt,
  clearOtpVerifyFailures,
  recordOtpVerifyFailure,
} from "./otp-rate-limit.ts";

describe("otp-rate-limit", () => {
  it("enforces send cooldown per email", () => {
    const email = `otp-cool-${Date.now()}@example.com`;
    const first = allowOtpSend("1.1.1.1", email);
    assert.equal(first.ok, true);
    const second = allowOtpSend("1.1.1.1", email);
    assert.equal(second.ok, false);
    if (!second.ok) assert.equal(second.reason, "cooldown");
  });

  it("locks verify after repeated failures", () => {
    const email = `otp-fail-${Date.now()}@example.com`;
    for (let i = 0; i < 5; i++) recordOtpVerifyFailure(email);
    const blocked = allowOtpVerifyAttempt(email);
    assert.equal(blocked.ok, false);
    clearOtpVerifyFailures(email);
    assert.equal(allowOtpVerifyAttempt(email).ok, true);
  });
});
