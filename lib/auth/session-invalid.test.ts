import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { isDefinitiveSessionInvalid, isTransientAuthFailure } from "./session-invalid.ts";

describe("session-invalid", () => {
  it("treats AuthRetryableFetchError / 503 as transient", () => {
    assert.equal(
      isTransientAuthFailure({ name: "AuthRetryableFetchError", message: "unavailable", status: 503 }),
      true,
    );
    assert.equal(isDefinitiveSessionInvalid({ name: "AuthRetryableFetchError", status: 503 }), false);
  });

  it("treats refresh/session missing as definitive", () => {
    assert.equal(
      isDefinitiveSessionInvalid({ code: "refresh_token_not_found", message: "Invalid Refresh Token" }),
      true,
    );
    assert.equal(isDefinitiveSessionInvalid({ code: "session_not_found" }), true);
  });

  it("does not clear on unknown errors", () => {
    assert.equal(isDefinitiveSessionInvalid({ message: "something weird" }), false);
    assert.equal(isDefinitiveSessionInvalid(null), false);
  });
});
