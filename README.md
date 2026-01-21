# TME Plus Bundle Offer Tool

Internal tool for processing TME Plus Mio Bundle offers during customer calls.

## Setup

### 1. Install Dependencies

```bash
cd bundle-tool
npm install
```

### 2. Configure Environment

Copy the example environment file and update with your credentials:

```bash
cp .env.example .env
```

Edit `.env` with your values:

```env
CHARGEBEE_SITE=your-chargebee-site
CHARGEBEE_API_KEY=your-api-key
CHARGEBEE_PLAN_ID=your-plan-id
CHARGEBEE_COUPON_ID=your-coupon-id
FULL_PAY_AMOUNT=299900
THREE_PAY_AMOUNT=106700
THREE_PAY_SCHEME_ID=your-scheme-id
TOOL_PASSWORD=your-password
PORT=3000
```

#### Finding the THREE_PAY_SCHEME_ID

The 3-Pay option requires a Payment Schedule Scheme in Chargebee. To find or create one:

1. Log into your Chargebee site
2. Go to **Settings** → **Configure Chargebee** → **Billing LogIQ** → **Payments** → **Payment Schedules**
3. Create a new scheme (if needed):
   - Name: "3 Monthly Payments" (or similar)
   - Number of payments: 3
   - Frequency: Monthly
4. Copy the scheme ID from the scheme details page
5. Add it to your `.env` file as `THREE_PAY_SCHEME_ID`

### 3. Start the Server

```bash
npm start
```

### 4. Access the Tool

Open your browser to: **http://localhost:3000**

Log in with the password configured in `TOOL_PASSWORD`.

## Usage

1. Enter customer email and click **Look Up**
2. Review customer details and payment method status
3. Click **Full Pay** ($2,999) or **3-Pay** ($1,067 × 3)
4. Confirm the charge in the modal
5. Note the transaction ID and manually provision user in membership.io

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "Customer not found" | Verify email exists in Chargebee |
| "No payment method on file" | Customer needs to add payment method in Chargebee first |
| "Payment failed" | Check Chargebee for specific error details |
| Server won't start | Verify `.env` file exists and has valid credentials |
