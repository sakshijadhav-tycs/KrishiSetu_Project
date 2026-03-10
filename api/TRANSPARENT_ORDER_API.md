# Transparent Multi-Vendor Order Module

## Purpose
Service-infrastructure model for farmer-to-customer commerce:
- Farmers set prices.
- Platform applies transparent commission, GST, and delivery.
- Multi-farmer cart is split into one main order and per-farmer sub-orders.

## Pricing Formula
- `commissionPercent`: from `Settings.defaultCommissionPercent` (fallback `10`)
- `gstPercent`: `5`
- `deliveryCharge`: `50`

For cart subtotal `S`:
- `commission = S * commissionPercent / 100`
- `gst = S * gstPercent / 100`
- `total = S + gst + deliveryCharge`

## New Collections
- `MainOrder`
- `SubOrder`
- `OrderItem`
- `CheckoutIntent`

## Flow
1. `POST /api/transparent-orders/checkout/create-order`
   - Validates product stock.
   - Creates `CheckoutIntent` snapshot.
   - Creates Razorpay order with `intentId` in notes.
2. `POST /api/transparent-orders/checkout/verify`
   - Verifies Razorpay signature.
   - Re-fetches payment details from Razorpay.
   - Uses Mongo transaction to:
     - reduce stock
     - create `MainOrder`
     - create split `SubOrder` per farmer
     - create `OrderItem` records
     - mark intent processed
3. Settlement:
   - `returnWindowDays`: 3
   - `autoSettlementDays`: 2 after return window
   - statuses: `Pending -> Eligible -> Transferred`
   - cron + on-demand sweep updates payout state.

## Endpoints

### Consumer
- `POST /api/transparent-orders/checkout/create-order`
- `POST /api/transparent-orders/checkout/verify`
- `GET /api/transparent-orders/my-orders`
- `GET /api/transparent-orders/:id`

### Farmer
- `GET /api/transparent-orders/farmer/sub-orders`
- `PATCH /api/transparent-orders/farmer/sub-orders/:id/delivered`

### Admin
- `GET /api/transparent-orders/admin/summary`
- `POST /api/transparent-orders/admin/settlement/sweep`
- `PATCH /api/transparent-orders/admin/sub-orders/:id/transfer`

## Admin Summary Metrics
- total commission earned
- total GST collected
- total delivery collected
- total payouts pending
- total payouts transferred

