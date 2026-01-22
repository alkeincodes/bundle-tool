const express = require('express');
const router = express.Router();
const { authenticate, login } = require('../middleware/auth');
const chargebeeService = require('../services/chargebee');
const { platformApiRequest } = require('../services/platform');
const config = require('../config');

// POST /api/auth/login
router.post('/auth/login', login);

// POST /api/auth/verify
router.post('/auth/verify', authenticate, (req, res) => {
  res.json({ success: true, message: 'Session is valid' });
});

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

    console.log(`[Customer Lookup] Success - ID: ${customer.id}, Email: ${customer.email}`);

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

// POST /api/register-to-mio
router.post('/register-to-mio', authenticate, async (req, res) => {
  try {
    const { customerId, email } = req.body;

    if (!customerId || !email) {
      return res.status(400).json({
        success: false,
        error: 'Customer ID and email are required'
      });
    }

    const apiResult = await platformApiRequest({
      endpoint: '/api/client/auth/register',
      method: 'POST',
      body: {
        customer_id: customerId,
        email
      },
      errorMessage: 'Failed to register to Mio'
    });

    console.log('[Register to Mio] Result:', apiResult);

    res.json({
      success: true,
      data: apiResult
    });
  } catch (error) {
    console.error('Register to Mio API error:', error);

    res.status(error.statusCode || 500).json({
      success: false,
      error: error.message || 'Failed to register to Mio'
    });
  }
});


// POST /api/register-to-hub
router.post('/register-to-hub', authenticate, async (req, res) => {
  try {
    const { email, name } = req.body;

    if (!email || !name) {
      return res.status(400).json({
        success: false,
        error: 'Email and name are required'
      });
    }

    console.log('asd:', {
      hub_hash: config.platform.hubHash,
      email,
      name,
      member_tag: config.platform.memberTag
    })
    const apiResult = await platformApiRequest({
      endpoint: '/api/client/hubs/auth/magic-link',
      method: 'POST',
      body: {
        hub_hash: config.platform.hubHash,
        email,
        name,
        member_tag: config.platform.memberTag
      },
      errorMessage: 'Failed to register to hub'
    });

    console.log('[Register to Hub] Result:', apiResult);

    res.json({
      success: true,
      data: apiResult
    });
  } catch (error) {
    console.error('Register to Hub API error:', error);

    res.status(error.statusCode || 500).json({
      success: false,
      error: error.message || 'Failed to register to hub'
    });
  }
});

module.exports = router;
