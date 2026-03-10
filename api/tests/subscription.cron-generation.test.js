import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import Subscription from "../models/SubscriptionModel.js";

const objectId = () => new mongoose.Types.ObjectId();

test("subscription pre-validate maps legacy fields used by cron query", async () => {
  const nextOrderDate = new Date("2026-03-10T00:00:00.000Z");
  const doc = new Subscription({
    consumer: objectId(),
    farmer: objectId(),
    product: objectId(),
    quantity: 1,
    frequency: "weekly",
    startDate: new Date("2026-03-01T00:00:00.000Z"),
    nextOrderDate,
    isActive: true,
  });

  await doc.validate();

  assert.equal(String(doc.customerId), String(doc.consumer));
  assert.equal(String(doc.farmerId), String(doc.farmer));
  assert.equal(String(doc.productId), String(doc.product));
  assert.equal(doc.status, "active");
  assert.equal(doc.isActive, true);
  assert.equal(new Date(doc.nextDeliveryDate).toISOString(), nextOrderDate.toISOString());
});

test("subscription pre-validate keeps status/isActive compatibility for paused/cancelled", async () => {
  const paused = new Subscription({
    customerId: objectId(),
    farmerId: objectId(),
    productId: objectId(),
    quantity: 1,
    frequency: "monthly",
    startDate: new Date("2026-03-01T00:00:00.000Z"),
    nextDeliveryDate: new Date("2026-03-20T00:00:00.000Z"),
    status: "paused",
    isActive: true,
  });
  await paused.validate();
  assert.equal(paused.isActive, false);

  const cancelled = new Subscription({
    customerId: objectId(),
    farmerId: objectId(),
    productId: objectId(),
    quantity: 1,
    frequency: "daily",
    startDate: new Date("2026-03-01T00:00:00.000Z"),
    nextDeliveryDate: new Date("2026-03-02T00:00:00.000Z"),
    status: "cancelled",
  });
  await cancelled.validate();
  assert.equal(cancelled.isActive, false);
  assert.ok(cancelled.cancelledAt instanceof Date);
});
