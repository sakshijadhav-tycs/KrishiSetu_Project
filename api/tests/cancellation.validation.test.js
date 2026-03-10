import test from "node:test";
import assert from "node:assert/strict";
import { cancelReasonBodySchema } from "../validators/orderSchemas.js";

test("cancel reason validation: accepts non-empty reason", () => {
  const parsed = cancelReasonBodySchema.safeParse({ reason: "Customer requested cancel" });
  assert.equal(parsed.success, true);
});

test("cancel reason validation: rejects empty reason", () => {
  const parsed = cancelReasonBodySchema.safeParse({ reason: "" });
  assert.equal(parsed.success, false);
});
