# 3-Pay Monthly Installments - Backend Logic Flow

## Overview

The 3-Pay option allows customers to pay $3,201 total ($1,067 × 3) spread across three monthly installments instead of a single $2,999 full payment.

## API Endpoint

```
POST /api/offer/three-pay
```

**Request Body:**
```json
{
  "customerId": "cust_xxx",
  "customerEmail": "customer@example.com"
}
```

## Processing Flow

### Step 1: Create or Update Subscription

**File:** `server/services/chargebee.js:56-112`

The system first checks if the customer has an existing subscription:

- If **existing subscription found**: Updates it with the new plan and coupon
  - Uses `chargebee.subscription.update_for_items()`
  - Applies changes immediately (`end_of_term: false`)
  - No proration (`prorate: false`)

- If **no existing subscription**: Creates a new one
  - Uses `chargebee.subscription.create_with_items()`
  - Attaches the plan ID and coupon from config

### Step 2: Calculate Total Amount

**File:** `server/services/chargebee.js:214-215`

```javascript
const fullThreePayAmount = config.pricing.threePayAmount * 3;
// $1,067 × 3 = $3,201 (stored in cents: 320100)
```

### Step 3: Create Pending Invoice

**File:** `server/services/chargebee.js:217-223`

Creates a single invoice for the full $3,201 amount with auto-collection disabled:

```javascript
const invoice = await createPendingInvoice(
  customerId,
  fullThreePayAmount,
  'TME Plus Mio Bundle - 3-Pay Plan ($1,067 × 3)'
);
```

**Chargebee API Call:**
```javascript
chargebee.invoice.create_for_charge_items_and_charges({
  customer_id: customerId,
  currency_code: 'USD',
  auto_collection: 'off',  // Prevents immediate collection
  charges: [{
    amount: amount,
    description: description
  }]
})
```

### Step 4: Get Payment Schedule Scheme ID

**File:** `server/services/chargebee.js:224-225`

Retrieves the pre-configured 3-pay payment schedule scheme ID from environment config:

```javascript
const schemeId = getThreePaySchemeId();
// Returns config.chargebee.threePaySchemeId
```

### Step 5: Apply Payment Schedule

**File:** `server/services/chargebee.js:227-228`

Applies Chargebee's payment schedule scheme to split the invoice:

```javascript
const scheduled = await applyPaymentSchedule(invoice.invoiceId, schemeId);
```

**Chargebee API Call:**
```javascript
chargebee.invoice.apply_payment_schedule_scheme(invoiceId, {
  scheme_id: schemeId
})
```

**What Chargebee Does:**
- Splits the $3,201 invoice into 3 equal payments of $1,067
- Charges the first payment immediately
- Schedules payments 2 and 3 for automatic collection on future dates

### Step 6: Generate Response

**File:** `server/services/chargebee.js:230-262`

Calculates payment dates and returns the result:

```javascript
const paymentDates = [
  now,           // Today (charged immediately)
  now + 1 month, // Payment 2 (scheduled)
  now + 2 months // Payment 3 (scheduled)
];

return {
  success: true,
  subscriptionId: subscription.subscriptionId,
  transactionId: invoice.invoiceId,
  invoiceStatus: scheduled.status,
  scheduledPayments: [
    { date: paymentDates[0], amount: "$1,067", description: "Payment 1 of 3 (charged now)" },
    { date: paymentDates[1], amount: "$1,067", description: "Payment 2 of 3 (scheduled)" },
    { date: paymentDates[2], amount: "$1,067", description: "Payment 3 of 3 (scheduled)" }
  ],
  message: "Successfully processed TME Plus 3-Pay with scheduled payments",
  manualStep: "Please manually provision user in membership.io"
};
```

## Flow Diagram

```
┌─────────────────────────────────────┐
│ POST /api/offer/three-pay           │
│ { customerId, customerEmail }       │
└──────────────────┬──────────────────┘
                   │
                   ▼
┌─────────────────────────────────────┐
│ 1. Create/Update Subscription       │
│    - Check for existing sub         │
│    - Apply plan + coupon            │
└──────────────────┬──────────────────┘
                   │
                   ▼
┌─────────────────────────────────────┐
│ 2. Create Pending Invoice           │
│    - Amount: $3,201                 │
│    - auto_collection: off           │
└──────────────────┬──────────────────┘
                   │
                   ▼
┌─────────────────────────────────────┐
│ 3. Apply Payment Schedule Scheme    │
│    - Splits into 3 payments         │
│    - Charges 1st payment now        │
│    - Schedules payments 2 & 3       │
└──────────────────┬──────────────────┘
                   │
                   ▼
┌─────────────────────────────────────┐
│ 4. Return Response                  │
│    - subscriptionId                 │
│    - transactionId (invoice)        │
│    - scheduledPayments array        │
└─────────────────────────────────────┘
```

## Key Configuration

Environment variables required (from `server/config.js`):

| Variable | Purpose |
|----------|---------|
| `CHARGEBEE_SITE` | Chargebee site identifier |
| `CHARGEBEE_API_KEY` | API authentication |
| `CHARGEBEE_PLAN_ID` | Plan to subscribe customer to |
| `CHARGEBEE_COUPON_ID` | Coupon to apply to subscription |
| `CHARGEBEE_THREE_PAY_SCHEME_ID` | Payment schedule scheme for 3 installments |
| `THREE_PAY_AMOUNT` | Single installment amount in cents (106700 = $1,067) |

## Error Handling

**File:** `server/routes/api.js:115-130`

- Chargebee API errors (e.g., payment failures) return 400 with specific error message
- Connection/server errors return 500 with generic message
- All errors are logged to console for debugging
