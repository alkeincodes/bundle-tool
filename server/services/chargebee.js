const chargebee = require('chargebee');
const config = require('../config');

// Initialize Chargebee
chargebee.configure({
  site: config.chargebee.site,
  api_key: config.chargebee.apiKey
});


/**
 * Look up a customer by email
 */
async function lookupCustomer(email) {
  const result = await chargebee.customer.list({
    'email[is]': email,
    limit: 1
  }).request();

  if (!result.list || result.list.length === 0) {
    return null;
  }

  const customerData = result.list[0].customer;
  const card = result.list[0].card;

  return {
    id: customerData.id,
    email: customerData.email,
    firstName: customerData.first_name || '',
    lastName: customerData.last_name || '',
    hasPaymentMethod: !!(customerData.payment_method && customerData.payment_method.status === 'valid') || !!card,
  };
}

/**
 * Get customer's existing subscriptions
 */
async function getExistingSubscriptions(customerId) {
  const result = await chargebee.subscription.list({
    'customer_id[is]': customerId,
    'status[in]': ['active', 'non_renewing', 'in_trial']
  }).request();

  return result.list.map(item => ({
    id: item.subscription.id,
    planId: item.subscription.plan_id,
    status: item.subscription.status
  }));
}

/**
 * Create or update subscription with coupon
 * If customer has existing subscription, update it instead of creating new one
 */
async function createOrUpdateSubscription(customerId) {
  // Check for existing active subscriptions
  const existingSubs = await getExistingSubscriptions(customerId);
  console.log(`[Subscription] Customer ${customerId}: Found ${existingSubs.length} existing subscriptions`);

  if (existingSubs.length > 0) {
    existingSubs.forEach(sub => {
      console.log(`[Subscription] Existing: ${sub.id} - Status: ${sub.status} - Plan: ${sub.planId}`);
    });
  }

  if (existingSubs.length > 0) {
    // Update existing subscription with the new plan and coupon
    const existingSub = existingSubs[0];
    console.log(`[Subscription] Updating subscription ${existingSub.id} to plan ${config.chargebee.planId}`);

    try {
      const result = await chargebee.subscription.update_for_items(existingSub.id, {
        subscription_items: [{
          item_price_id: config.chargebee.planId,
          quantity: 1
        }],
        coupon_ids: [config.chargebee.couponId],
        // Apply changes immediately, no proration for bundle offers
        end_of_term: false,
        prorate: false
      }).request();

      console.log(`[Subscription] Successfully updated to ${result.subscription.id}`);
      return {
        subscriptionId: result.subscription.id,
        status: result.subscription.status,
        updated: true
      };
    } catch (updateError) {
      console.error(`[Subscription] Update failed: ${updateError.message}`);
      throw updateError;
    }
  }

  // No existing subscription, create new one
  console.log(`[Subscription] No existing subscription, creating new one`);
  const result = await chargebee.subscription.create_with_items(customerId, {
    subscription_items: [{
      item_price_id: config.chargebee.planId,
      quantity: 1
    }],
    coupon_ids: [config.chargebee.couponId]
  }).request();

  console.log(`[Subscription] Created new subscription ${result.subscription.id}`);
  return {
    subscriptionId: result.subscription.id,
    status: result.subscription.status,
    updated: false
  };
}

/**
 * Create one-time charge invoice (collected immediately)
 */
async function createOneTimeCharge(customerId, amount, description) {
  const result = await chargebee.invoice.create_for_charge_items_and_charges({
    customer_id: customerId,
    currency_code: 'USD',
    charges: [{
      amount: amount,
      description: description
    }]
  }).request();

  return {
    invoiceId: result.invoice.id,
    status: result.invoice.status,
    amountPaid: result.invoice.amount_paid,
    amountDue: result.invoice.amount_due
  };
}

/**
 * Create invoice with auto_collection off (not collected immediately)
 */
async function createPendingInvoice(customerId, amount, description) {
  const result = await chargebee.invoice.create_for_charge_items_and_charges({
    customer_id: customerId,
    currency_code: 'USD',
    auto_collection: 'off',
    charges: [{
      amount: amount,
      description: description
    }]
  }).request();

  return {
    invoiceId: result.invoice.id,
    status: result.invoice.status,
    total: result.invoice.total
  };
}

/**
 * Get the payment schedule scheme ID for 3-pay (3 monthly payments)
 */
function getThreePaySchemeId() {
  return config.chargebee.threePaySchemeId;
}

/**
 * Apply payment schedule scheme to an invoice
 */
async function applyPaymentSchedule(invoiceId, schemeId) {
  const result = await chargebee.invoice.apply_payment_schedule_scheme(invoiceId, {
    scheme_id: schemeId
  }).request();

  return {
    invoiceId: result.invoice.id,
    status: result.invoice.status,
    paymentSchedules: result.payment_schedules
  };
}

/**
 * Process Full Pay offer
 * - Create subscription with coupon
 * - Create one-time $2,999 charge
 */
async function processFullPay(customerId, customerEmail) {
  // 1. Create or update subscription with coupon
  const subscription = await createOrUpdateSubscription(customerId);

  // 2. Create one-time charge for $2,999
  const charge = await createOneTimeCharge(
    customerId,
    config.pricing.fullPayAmount,
    'TME Plus Mio Bundle - Full Pay'
  );

  return {
    success: true,
    subscriptionId: subscription.subscriptionId,
    transactionId: charge.invoiceId,
    invoiceStatus: charge.status,
    message: 'Successfully processed TME Plus Full Pay',
    manualStep: 'Please manually provision user in membership.io'
  };
}

/**
 * Process 3-Pay offer
 * - Create subscription with coupon
 * - Create ONE invoice for full 3-pay amount ($3,201)
 * - Apply payment schedule scheme to split into 3 monthly payments
 */
async function processThreePay(customerId, customerEmail) {
  // 1. Create or update subscription with coupon
  const subscription = await createOrUpdateSubscription(customerId);

  // 2. Calculate full 3-pay amount ($1,067 × 3 = $3,201)
  const fullThreePayAmount = config.pricing.threePayAmount * 3;

  // 3. Create ONE invoice for the full amount (not collected yet)
  const invoice = await createPendingInvoice(
    customerId,
    fullThreePayAmount,
    'TME Plus Mio Bundle - 3-Pay Plan ($1,067 × 3)'
  );

  // 4. Get the 3-pay payment schedule scheme ID
  const schemeId = getThreePaySchemeId();

  // 5. Apply payment schedule to the invoice (splits into 3 monthly payments)
  const scheduled = await applyPaymentSchedule(invoice.invoiceId, schemeId);

  // 6. Calculate payment dates for display
  const now = new Date();
  const paymentDates = [
    now.toISOString().split('T')[0],
    new Date(now.setMonth(now.getMonth() + 1)).toISOString().split('T')[0],
    new Date(now.setMonth(now.getMonth() + 1)).toISOString().split('T')[0]
  ];

  return {
    success: true,
    subscriptionId: subscription.subscriptionId,
    transactionId: invoice.invoiceId,
    invoiceStatus: scheduled.status,
    scheduledPayments: [
      {
        date: paymentDates[0],
        amount: `$${(config.pricing.threePayAmount / 100).toLocaleString()}`,
        description: 'Payment 1 of 3 (charged now)'
      },
      {
        date: paymentDates[1],
        amount: `$${(config.pricing.threePayAmount / 100).toLocaleString()}`,
        description: 'Payment 2 of 3 (scheduled)'
      },
      {
        date: paymentDates[2],
        amount: `$${(config.pricing.threePayAmount / 100).toLocaleString()}`,
        description: 'Payment 3 of 3 (scheduled)'
      }
    ],
    message: 'Successfully processed TME Plus 3-Pay with scheduled payments',
    manualStep: 'Please manually provision user in membership.io'
  };
}

module.exports = {
  lookupCustomer,
  getExistingSubscriptions,
  createOrUpdateSubscription,
  createOneTimeCharge,
  createPendingInvoice,
  getThreePaySchemeId,
  applyPaymentSchedule,
  processFullPay,
  processThreePay
};
