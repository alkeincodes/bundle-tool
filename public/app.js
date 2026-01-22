// State
let sessionId = null;
let currentCustomer = null;

// DOM Elements
const loginScreen = document.getElementById('login-screen');
const mainScreen = document.getElementById('main-screen');
const loginForm = document.getElementById('login-form');
const loginError = document.getElementById('login-error');
const logoutBtn = document.getElementById('logout-btn');

const lookupSection = document.getElementById('lookup-section');
const lookupForm = document.getElementById('lookup-form');
const lookupError = document.getElementById('lookup-error');
const emailInput = document.getElementById('email');

const customerSection = document.getElementById('customer-section');
const customerName = document.getElementById('customer-name');
const customerEmail = document.getElementById('customer-email');
const customerPayment = document.getElementById('customer-payment');
const existingSubInfo = document.getElementById('existing-sub-info');
const resetBtn = document.getElementById('reset-btn');

const fullPayBtn = document.getElementById('full-pay-btn');
const threePayBtn = document.getElementById('three-pay-btn');

const confirmModal = document.getElementById('confirm-modal');
const confirmName = document.getElementById('confirm-name');
const confirmEmail = document.getElementById('confirm-email');
const confirmOffer = document.getElementById('confirm-offer');
const confirmAmount = document.getElementById('confirm-amount');
const confirmCancelBtn = document.getElementById('confirm-cancel-btn');
const confirmProceedBtn = document.getElementById('confirm-proceed-btn');
const confirmError = document.getElementById('confirm-error');

const successModal = document.getElementById('success-modal');
const successTransaction = document.getElementById('success-transaction');
const successSubscription = document.getElementById('success-subscription');
const scheduledPayments = document.getElementById('scheduled-payments');
const scheduledList = document.getElementById('scheduled-list');
const successDoneBtn = document.getElementById('success-done-btn');

const loadingOverlay = document.getElementById('loading-overlay');
const loadingMessage = document.getElementById('loading-message');

let pendingOffer = null;
let isProcessing = false;

// Make an authenticated API call

// Utility Functions
function showLoading(message = 'Processing...') {
  loadingMessage.textContent = message;
  loadingOverlay.classList.remove('hidden');
}

function hideLoading() {
  loadingOverlay.classList.add('hidden');
}

function showError(element, message) {
  element.textContent = message;
  element.classList.remove('hidden');
}

function clearError(element) {
  element.textContent = '';
}

async function apiRequest(endpoint, data = {}) {
  const headers = {
    'Content-Type': 'application/json'
  };

  if (sessionId) {
    headers['X-Session-Id'] = sessionId;
  }

  const response = await fetch(`/api${endpoint}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(data)
  });

  const result = await response.json();

  if (!response.ok) {
    // If unauthorized, clear session and show login page
    if (response.status === 401) {
      sessionId = null;
      localStorage.removeItem('sessionId');
      mainScreen.classList.add('hidden');
      loginScreen.classList.remove('hidden');
      resetCustomerView();
    }
    throw new Error(result.error || 'An error occurred');
  }

  return result;
}

// Login
loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  clearError(loginError);

  const password = document.getElementById('password').value;

  try {
    showLoading('Logging in...');
    const result = await apiRequest('/auth/login', { password });
    sessionId = result.sessionId;
    localStorage.setItem('sessionId', sessionId);

    loginScreen.classList.add('hidden');
    mainScreen.classList.remove('hidden');
    document.getElementById('password').value = '';
  } catch (error) {
    showError(loginError, error.message);
  } finally {
    hideLoading();
  }
});

// Logout
logoutBtn.addEventListener('click', () => {
  sessionId = null;
  currentCustomer = null;
  localStorage.removeItem('sessionId');
  mainScreen.classList.add('hidden');
  loginScreen.classList.remove('hidden');
  resetCustomerView();
});

// Customer Lookup
lookupForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  clearError(lookupError);

  const email = emailInput.value.trim();

  try {
    showLoading('Looking up customer...');
    const result = await apiRequest('/customer/lookup', { email });

    console.log('[Customer Lookup] Success - ID:', result.customer.id, 'Email:', result.customer.email, 'Name:', `${result.customer.firstName} ${result.customer.lastName}`.trim());

    currentCustomer = result.customer;
    displayCustomer(result.customer);
  } catch (error) {
    showError(lookupError, error.message);
  } finally {
    hideLoading();
  }
});

function displayCustomer(customer) {
  customerName.textContent = `${customer.firstName} ${customer.lastName}`.trim() || 'N/A';
  customerEmail.textContent = customer.email;
  customerPayment.textContent = customer.hasPaymentMethod ? 'On file' : 'None';

  if (customer.existingSubscription) {
    existingSubInfo.classList.remove('hidden');
  } else {
    existingSubInfo.classList.add('hidden');
  }

  lookupSection.classList.add('hidden');
  customerSection.classList.remove('hidden');
}

function resetCustomerView() {
  currentCustomer = null;
  emailInput.value = '';
  clearError(lookupError);
  customerSection.classList.add('hidden');
  lookupSection.classList.remove('hidden');
}

resetBtn.addEventListener('click', resetCustomerView);

// Offer Buttons
fullPayBtn.addEventListener('click', () => {
  pendingOffer = 'full-pay';
  console.log('full pay')
  showConfirmModal('Full Pay', '$2,999');
});

threePayBtn.addEventListener('click', () => {
  pendingOffer = 'three-pay';
  showConfirmModal('3-Pay', '$1,067 × 3 ($3,201 total)');
});

function showConfirmModal(offerType, amount) {
  confirmName.textContent = `${currentCustomer.firstName} ${currentCustomer.lastName}`.trim() || 'N/A';
  confirmEmail.textContent = currentCustomer.email;
  confirmOffer.textContent = `TME Plus Bundle - ${offerType}`;
  confirmAmount.textContent = amount;
  clearError(confirmError);
  confirmModal.classList.remove('hidden');
}

// Confirm Modal
confirmCancelBtn.addEventListener('click', () => {
  pendingOffer = null;
  confirmModal.classList.add('hidden');
});

confirmProceedBtn.addEventListener('click', async () => {
  // Prevent double-clicks
  if (isProcessing) return;
  isProcessing = true;
  confirmProceedBtn.disabled = true;

  clearError(confirmError);

  const endpoint = pendingOffer === 'full-pay' ? '/offer/full-pay' : '/offer/three-pay';
  const loadingMsg = pendingOffer === 'full-pay'
    ? 'Processing $2,999 charge...'
    : 'Processing first payment...';

  try {
    showLoading(loadingMsg);
    confirmModal.classList.add('hidden');

    const result = await apiRequest(endpoint, {
      customerId: currentCustomer.id,
      customerEmail: currentCustomer.email
    });

    // Register customer to Mio
    try {
      const mioResult = await apiRequest('/register-to-mio', {
        customerId: currentCustomer.id,
        email: currentCustomer.email
      });
      console.log('[Register to Mio] Result:', mioResult.data);
    } catch (mioError) {
      console.error('[Register to Mio] Error:', mioError.message);
      showError(confirmError, `Mio registration failed: ${mioError.message}`);
      confirmModal.classList.remove('hidden');
      return;
    }

    // Register customer to hub
    try {
      const hubResult = await apiRequest('/register-to-hub', {
        email: currentCustomer.email,
        name: `${currentCustomer.firstName} ${currentCustomer.lastName}`.trim()
      });
      console.log('[Register to Hub] Result:', hubResult.data);
    } catch (hubError) {
      console.error('[Register to Hub] Error:', hubError.message);
      showError(confirmError, `Hub registration failed: ${hubError.message}`);
      confirmModal.classList.remove('hidden');
      return;
    }

    await showSuccessModal(result);
  } catch (error) {
    confirmModal.classList.remove('hidden');
    showError(confirmError, error.message);
  } finally {
    hideLoading();
    isProcessing = false;
    confirmProceedBtn.disabled = false;
  }
});

// Success Modal
async function showSuccessModal(result) {
  successTransaction.textContent = result.transactionId;
  successSubscription.textContent = result.subscriptionId;

  if (result.scheduledPayments && result.scheduledPayments.length > 0) {
    scheduledList.innerHTML = result.scheduledPayments
      .map(p => `<li>${p.date}: ${p.amount} - ${p.description}</li>`)
      .join('');
    scheduledPayments.classList.remove('hidden');
  } else {
    scheduledPayments.classList.add('hidden');
  }

  successModal.classList.remove('hidden');
}

successDoneBtn.addEventListener('click', () => {
  successModal.classList.add('hidden');
  resetCustomerView();
});

// Check for existing session on load
document.addEventListener('DOMContentLoaded', async () => {
  const savedSessionId = localStorage.getItem('sessionId');
  if (savedSessionId) {
    sessionId = savedSessionId;

    // Verify session is still valid
    try {
      showLoading('Verifying session...');
      await apiRequest('/auth/verify');
      loginScreen.classList.add('hidden');
      mainScreen.classList.remove('hidden');
    } catch (error) {
      // apiRequest handles 401 by showing login page
      console.log('[Session] Invalid or expired');
    } finally {
      hideLoading();
    }
  }
});
