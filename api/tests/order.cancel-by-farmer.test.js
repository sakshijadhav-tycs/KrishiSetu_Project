import test from "node:test";
import assert from "node:assert/strict";

const makeRes = () => {
  const res = {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
  return res;
};

const makeQuery = (orderDoc) => ({
  populate() {
    return this;
  },
  then(resolve) {
    return resolve(orderDoc);
  },
});

let cancelOrderByFarmer;
let Order;
let originalFindById;

test.before(async () => {
  process.env.RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID || "test_key";
  process.env.RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || "test_secret";

  const controllerModule = await import("../controllers/orderController.js");
  const orderModule = await import("../models/OrderModel.js");

  cancelOrderByFarmer = controllerModule.cancelOrderByFarmer;
  Order = orderModule.default;
  originalFindById = Order.findById;
});

test.after(() => {
  if (Order && originalFindById) {
    Order.findById = originalFindById;
  }
});

test("POST /api/orders/:id/cancel-by-farmer -> reason is mandatory", async () => {
  const req = {
    params: { id: "order_1" },
    body: {},
    user: { _id: { toString: () => "farmer_1" }, role: "farmer" },
  };
  const res = makeRes();

  await cancelOrderByFarmer(req, res);

  assert.equal(res.statusCode, 400);
  assert.equal(res.body?.success, false);
  assert.match(String(res.body?.message || ""), /reason/i);
});

test("POST /api/orders/:id/cancel-by-farmer -> rejects non-pending/non-accepted status", async () => {
  const orderDoc = {
    _id: "order_2",
    status: "shipped",
    paymentMethod: "cod",
    items: [
      {
        farmer: { _id: { toString: () => "farmer_1" }, name: "Farmer One" },
        product: { name: "Tomato" },
      },
    ],
    save: async () => orderDoc,
    populate: async () => orderDoc,
  };
  Order.findById = () => makeQuery(orderDoc);

  const req = {
    params: { id: "order_2" },
    body: { reason: "Out of stock" },
    user: { _id: { toString: () => "farmer_1" }, role: "farmer", name: "Farmer One" },
  };
  const res = makeRes();

  await cancelOrderByFarmer(req, res);

  assert.equal(res.statusCode, 400);
  assert.equal(res.body?.success, false);
  assert.match(String(res.body?.message || ""), /pending|confirmed/i);
});

test("POST /api/orders/:id/cancel-by-farmer -> prevents duplicate cancellation", async () => {
  const orderDoc = {
    _id: "order_3",
    status: "CANCELLED_BY_FARMER",
    paymentMethod: "cod",
    items: [
      {
        farmer: { _id: { toString: () => "farmer_1" }, name: "Farmer One" },
        product: { name: "Onion" },
      },
    ],
    save: async () => orderDoc,
    populate: async () => orderDoc,
  };
  Order.findById = () => makeQuery(orderDoc);

  const req = {
    params: { id: "order_3" },
    body: { reason: "Duplicate test" },
    user: { _id: { toString: () => "farmer_1" }, role: "farmer", name: "Farmer One" },
  };
  const res = makeRes();

  await cancelOrderByFarmer(req, res);

  assert.equal(res.statusCode, 400);
  assert.equal(res.body?.success, false);
  assert.match(String(res.body?.message || ""), /already cancelled/i);
});
