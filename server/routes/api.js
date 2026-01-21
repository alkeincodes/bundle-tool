const express = require('express');
const router = express.Router();
const { authenticate, login } = require('../middleware/auth');
const chargebeeService = require('../services/chargebee');

// POST /api/auth/login
router.post('/auth/login', login);

// POST /api/customer/lookup
router.post('/customer/lookup', authenticate, async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        error: 'Email is required'
      });
    }

    const customer = await chargebeeService.lookupCustomer(email);

    if (!customer) {
      return res.status(404).json({
        success: false,
        error: 'Customer not found. Please verify the email address.'
      });
    }

    if (!customer.hasPaymentMethod) {
      return res.status(400).json({
        success: false,
        error: 'Customer has no payment method on file.',
        customer: {
          id: customer.id,
          email: customer.email,
          firstName: customer.firstName,
          lastName: customer.lastName,
          hasPaymentMethod: false
        }
      });
    }

    // Get existing subscriptions
    const existingSubscriptions = await chargebeeService.getExistingSubscriptions(customer.id);

    res.json({
      success: true,
      customer: {
        id: customer.id,
        email: customer.email,
        firstName: customer.firstName,
        lastName: customer.lastName,
        hasPaymentMethod: customer.hasPaymentMethod,
        existingSubscription: existingSubscriptions.length > 0 ? existingSubscriptions[0] : null
      }
    });
  } catch (error) {
    console.error('Customer lookup error:', error);
    res.status(500).json({
      success: false,
      error: 'Connection error. Please try again.'
    });
  }
});

// POST /api/offer/full-pay
router.post('/offer/full-pay', authenticate, async (req, res) => {
  try {
    const { customerId, customerEmail } = req.body;

    if (!customerId || !customerEmail) {
      return res.status(400).json({
        success: false,
        error: 'Customer ID and email are required'
      });
    }

    const result = await chargebeeService.processFullPay(customerId, customerEmail);

    res.json(result);
  } catch (error) {
    console.error('Full pay processing error:', error);

    // Handle specific Chargebee errors
    if (error.api_error_code) {
      return res.status(400).json({
        success: false,
        error: `Payment failed: ${error.message}`
      });
    }

    res.status(500).json({
      success: false,
      error: 'Connection error. Please try again.'
    });
  }
});

// POST /api/offer/three-pay
router.post('/offer/three-pay', authenticate, async (req, res) => {
  try {
    const { customerId, customerEmail } = req.body;

    if (!customerId || !customerEmail) {
      return res.status(400).json({
        success: false,
        error: 'Customer ID and email are required'
      });
    }

    const result = await chargebeeService.processThreePay(customerId, customerEmail);

    res.json(result);
  } catch (error) {
    console.error('Three pay processing error:', error);

    // Handle specific Chargebee errors
    if (error.api_error_code) {
      return res.status(400).json({
        success: false,
        error: `Payment failed: ${error.message}`
      });
    }

    res.status(500).json({
      success: false,
      error: 'Connection error. Please try again.'
    });
  }
});

module.exports = router;
