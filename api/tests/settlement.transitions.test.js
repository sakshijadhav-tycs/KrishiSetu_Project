import test from "node:test";
import assert from "node:assert/strict";
import {
  evaluateEligibility,
  markTransferred,
  promoteToEligible,
} from "../services/settlementService.js";

const makeOrder = (overrides = {}) => {
  let saveCount = 0;
  return {
    payoutStatus: "Pending",
    status: "accepted",
    autoSettleAt: new Date(Date.now() - 60 * 1000),
    payoutError: "",
    providerPayoutId: "",
    save: async function save() {
      saveCount += 1;
      return this;
    },
    getSaveCount: () => saveCount,
    ...overrides,
  };
};

test("settlement eligibility: pending due order can promote", () => {
  const order = makeOrder({ payoutStatus: "Pending" });
  const out = evaluateEligibility(order, new Date());
  assert.equal(out.canPromote, true);
  assert.equal(out.canTransfer, false);
});

test("settlement transition: promote pending -> eligible", async () => {
  const order = makeOrder({ payoutStatus: "Pending" });
  const result = await promoteToEligible(order, new Date());
  assert.equal(result.updated, true);
  assert.equal(order.payoutStatus, "Eligible");
  assert.equal(order.getSaveCount(), 1);
});

test("settlement transition: eligible -> transferred", async () => {
  const order = makeOrder({ payoutStatus: "Eligible" });
  const result = await markTransferred(order, new Date());
  assert.equal(result.updated, true);
  assert.equal(order.payoutStatus, "Transferred");
  assert.equal(order.getSaveCount(), 1);
});

test("settlement transition is blocked for terminal order status", async () => {
  const order = makeOrder({ status: "cancelled", payoutStatus: "Pending" });
  const eligibility = evaluateEligibility(order, new Date());
  assert.equal(eligibility.canPromote, false);
  const promoted = await promoteToEligible(order, new Date());
  assert.equal(promoted.updated, false);
  assert.equal(order.getSaveCount(), 0);
});
