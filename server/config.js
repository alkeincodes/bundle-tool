require('dotenv').config();

module.exports = {
  chargebee: {
    site: process.env.CHARGEBEE_SITE,
    apiKey: process.env.CHARGEBEE_API_KEY,
    planId: process.env.CHARGEBEE_PLAN_ID,
    couponId: process.env.CHARGEBEE_COUPON_ID,
    threePaySchemeId: process.env.THREE_PAY_SCHEME_ID,
  },
  pricing: {
    fullPayAmount: parseInt(process.env.FULL_PAY_AMOUNT, 10),
    threePayAmount: parseInt(process.env.THREE_PAY_AMOUNT, 10),
  },
  auth: {
    password: process.env.TOOL_PASSWORD,
  },
  server: {
    port: parseInt(process.env.PORT, 10) || 3000,
  },
};
