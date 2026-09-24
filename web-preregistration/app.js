/**
 * app.js
 *
 * Client logic for XploreQuest Web Pre-Registration Form.
 * Integrates with Firebase App Check (reCAPTCHA v3/Enterprise) and public API endpoints.
 */

(function () {
  'use strict';

  // State Variables
  let eventData = null;
  let receiptBase64 = null;
  let receiptContentType = null;
  let appCheckInstance = null;

  // DOM Elements
  const loadingState = document.getElementById('loadingState');
  const errorState = document.getElementById('errorState');
  const errorTitle = document.getElementById('errorTitle');
  const errorMessage = document.getElementById('errorMessage');
  const formContainer = document.getElementById('formContainer');
  const preRegForm = document.getElementById('preRegForm');
  const successState = document.getElementById('successState');

  // Event Detail Elements
  const eventNameEl = document.getElementById('eventName');
  const eventDateEl = document.getElementById('eventDate');
  const eventLocationEl = document.getElementById('eventLocation');
  const eventFeeEl = document.getElementById('eventFee');
  const eventMaxTeamEl = document.getElementById('eventMaxTeam');
  const eventBannerContainer = document.getElementById('eventBannerContainer');
  const eventBannerImg = document.getElementById('eventBannerImg');
  const paymentDetailsBox = document.getElementById('paymentDetailsBox');
  const bankDetailsText = document.getElementById('bankDetailsText');
  const paymentQrWrapper = document.getElementById('paymentQrWrapper');
  const paymentQrImg = document.getElementById('paymentQrImg');
  const membersInputsContainer = document.getElementById('membersInputsContainer');

  // File Upload Elements
  const receiptFileInput = document.getElementById('receiptFile');
  const dropzoneContent = document.getElementById('dropzoneContent');
  const previewWrapper = document.getElementById('previewWrapper');
  const imagePreview = document.getElementById('imagePreview');
  const btnRemoveImage = document.getElementById('btnRemoveImage');
  const receiptFileError = document.getElementById('receiptFileError');

  // Submit Button Elements
  const btnSubmit = document.getElementById('btnSubmit');
  const btnSubmitText = document.getElementById('btnSubmitText');
  const btnSpinner = document.getElementById('btnSpinner');

  // Helper: Extract slug from URL path or query string
  function getSlugFromUrl() {
    const path = window.location.pathname;
    const matches = path.match(/\/registration-form\/([^/]+)/);
    if (matches && matches[1]) {
      return decodeURIComponent(matches[1]);
    }

    const altMatches = path.match(/\/(?:register|events|form|event)\/([^/]+)/);
    if (altMatches && altMatches[1]) {
      return decodeURIComponent(altMatches[1]);
    }

    const params = new URLSearchParams(window.location.search);
    if (params.has('slug')) return params.get('slug');
    if (params.has('eventId')) return params.get('eventId');
    if (params.has('id')) return params.get('id');
    if (params.has('event')) return params.get('event');
    if (params.has('code')) return params.get('code');

    const segments = path.split('/').filter(Boolean);
    if (segments.length > 0 && !segments[segments.length - 1].includes('.')) {
      const lastSeg = decodeURIComponent(segments[segments.length - 1]);
      if (lastSeg !== 'register' && lastSeg !== 'index.html') {
        return lastSeg;
      }
    }
    return '';
  }

  // Helper: Initialize Firebase App Check
  function initAppCheck() {
    try {
      if (!window.firebase || !window.firebase.appCheck) {
        console.error('[AppCheck] ERROR: Firebase App Check SDK compat script is not loaded.');
        return;
      }

      const siteKey = window.RECAPTCHA_SITE_KEY;
      const config = window.FIREBASE_CONFIG;

      if (!siteKey || !config || !config.apiKey || !config.projectId) {
        console.error(
          '[AppCheck] ERROR: Firebase App Check initialization failed. Missing window.RECAPTCHA_SITE_KEY or window.FIREBASE_CONFIG.'
        );
        return;
      }

      if (!firebase.apps.length) {
        firebase.initializeApp(config);
      }

      appCheckInstance = firebase.appCheck();
      appCheckInstance.activate(
        new firebase.appCheck.ReCaptchaV3Provider(siteKey),
        true // isTokenAutoRefreshEnabled
      );
      console.log('[AppCheck] Initialized successfully with ReCaptchaV3Provider.');
    } catch (err) {
      console.error('[AppCheck] ERROR during App Check activation:', err);
    }
  }

  async function getAppCheckToken() {
    if (!appCheckInstance) return '';
    try {
      const result = await appCheckInstance.getToken(false);
      return result.token || '';
    } catch (err) {
      console.warn('[AppCheck] Failed to retrieve token:', err);
      return '';
    }
  }

  // Fetch Event Data from Backend
  async function fetchEventDetails(slug) {
    if (!slug) {
      showError('Event Not Found', 'Please use a valid registration form link (e.g., /registration-form/event-slug).');
      return;
    }

    try {
      const appCheckToken = await getAppCheckToken();
      const headers = {};
      if (appCheckToken) {
        headers['X-Firebase-AppCheck'] = appCheckToken;
      }

      const response = await fetch(`/api/public/events/${encodeURIComponent(slug)}`, { headers });
      const payload = await response.json();

      if (!response.ok || !payload.success) {
        const errorMsg = payload.error?.message || 'Event does not exist or has been archived.';
        showError('Event Not Found', errorMsg);
        return;
      }

      eventData = payload.data;
      renderEventDetails(eventData);
    } catch (err) {
      console.error('Failed to fetch event:', err);
      showError('Network Error', 'Failed to connect to the server. Please check your internet connection and try again.');
    }
  }

  function renderEventDetails(event) {
    eventNameEl.textContent = event.name;
    eventDateEl.textContent = event.date || 'To be announced';
    eventLocationEl.textContent = event.locationName || 'To be announced';
    
    // Fee formatting
    if (event.entryFee && event.entryFee > 0) {
      eventFeeEl.textContent = `RM ${event.entryFee.toFixed(2)}`;
    } else {
      eventFeeEl.textContent = 'FREE';
    }

    const maxTeamSize = event.maxTeamSize || 4;
    eventMaxTeamEl.textContent = `${maxTeamSize} members / team`;

    // Banner image
    if (event.bannerImageUrl) {
      eventBannerImg.src = event.bannerImageUrl;
      eventBannerContainer.classList.remove('hidden');
    }

    // Bank Details & Payment QR (Feature 4C)
    const hasStructuredDetails = event.paymentDetails && (
      event.paymentDetails.bankName ||
      event.paymentDetails.accountNumber ||
      event.paymentDetails.accountHolderName
    );
    const hasLegacyDetails = !!event.paymentBankDetails;
    const hasQrImage = !!event.paymentQrImageUrl;

    if (hasStructuredDetails || hasLegacyDetails || hasQrImage) {
      paymentDetailsBox.classList.remove('hidden');

      if (hasStructuredDetails) {
        const pd = event.paymentDetails;
        let formattedText = '';
        if (pd.bankName) formattedText += `Bank: ${pd.bankName}\n`;
        if (pd.accountNumber) formattedText += `Account Number: ${pd.accountNumber}\n`;
        if (pd.accountHolderName) formattedText += `Account Holder: ${pd.accountHolderName}\n`;
        if (pd.note) formattedText += `\nNote: ${pd.note}`;
        bankDetailsText.textContent = formattedText.trim();
      } else if (hasLegacyDetails) {
        bankDetailsText.textContent = event.paymentBankDetails;
      } else if (hasQrImage) {
        bankDetailsText.textContent = 'Please refer to the payment QR image below.';
      }

      if (hasQrImage) {
        paymentQrImg.src = event.paymentQrImageUrl;
        paymentQrWrapper.classList.remove('hidden');
      }
    } else {
      // Empty State: Neither text details nor QR image are set
      paymentDetailsBox.classList.remove('hidden');
      bankDetailsText.textContent = 'Bank account details have not been configured by the organizer yet. Please contact the organizer for payment details.';
    }

    // Render Member Input fields (maxTeamSize - 1)
    renderMemberInputs(maxTeamSize);

    loadingState.classList.add('hidden');
    errorState.classList.add('hidden');
    successState.classList.add('hidden');
    formContainer.classList.remove('hidden');
  }

  function renderMemberInputs(maxTeamSize) {
    membersInputsContainer.innerHTML = '';
    const additionalMembers = maxTeamSize - 1;

    for (let i = 1; i <= additionalMembers; i++) {
      const memberIndex = i + 1;
      const groupDiv = document.createElement('div');
      groupDiv.className = 'form-group';
      groupDiv.innerHTML = `
        <label for="member_${i}">Member ${memberIndex} Full Name <span class="req">*</span></label>
        <input type="text" id="member_${i}" class="member-input" placeholder="Full name as per ID document" required maxlength="100" />
        <span class="field-error" id="member_${i}_error"></span>
      `;
      membersInputsContainer.appendChild(groupDiv);
    }
  }

  function showError(title, msg) {
    loadingState.classList.add('hidden');
    formContainer.classList.add('hidden');
    successState.classList.add('hidden');
    errorTitle.textContent = title;
    errorMessage.textContent = msg;
    errorState.classList.remove('hidden');
  }

  // Handle File Selection & Conversion to Base64
  receiptFileInput.addEventListener('change', function (e) {
    const file = e.target.files[0];
    if (!file) return;

    receiptFileError.textContent = '';

    // Validate type
    const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      receiptFileError.textContent = 'Invalid file format. Please select a JPEG, PNG, or WebP image.';
      receiptFileInput.value = '';
      return;
    }

    // Validate size (< 5MB)
    if (file.size > 5 * 1024 * 1024) {
      receiptFileError.textContent = 'File size exceeds 5MB. Please select a smaller image.';
      receiptFileInput.value = '';
      return;
    }

    receiptContentType = file.type;

    const reader = new FileReader();
    reader.onload = function (evt) {
      const result = evt.target.result;
      // Strip data URL prefix (e.g. "data:image/png;base64,")
      receiptBase64 = result.split(',')[1] || result;

      imagePreview.src = result;
      dropzoneContent.classList.add('hidden');
      previewWrapper.classList.remove('hidden');
    };
    reader.readAsDataURL(file);
  });

  btnRemoveImage.addEventListener('click', function (e) {
    e.stopPropagation();
    receiptFileInput.value = '';
    receiptBase64 = null;
    receiptContentType = null;
    imagePreview.src = '';
    previewWrapper.classList.add('hidden');
    dropzoneContent.classList.remove('hidden');
  });

  // Client Validation
  function validateForm() {
    let isValid = true;
    
    // Reset errors
    document.querySelectorAll('.field-error').forEach(el => el.textContent = '');

    const teamNameInput = document.getElementById('teamName');
    const leaderNameInput = document.getElementById('leaderName');
    const leaderWhatsAppInput = document.getElementById('leaderWhatsApp');

    if (!teamNameInput.value.trim()) {
      document.getElementById('teamNameError').textContent = 'Team name is required.';
      isValid = false;
    }

    if (!leaderNameInput.value.trim()) {
      document.getElementById('leaderNameError').textContent = 'Team leader name is required.';
      isValid = false;
    }

    const phoneRegex = /^(\+?60|0)1[0-46-9][0-9]{7,8}$/;
    const phoneVal = leaderWhatsAppInput.value.trim();
    if (!phoneVal) {
      document.getElementById('leaderWhatsAppError').textContent = 'Leader WhatsApp number is required.';
      isValid = false;
    } else if (!phoneRegex.test(phoneVal)) {
      document.getElementById('leaderWhatsAppError').textContent = 'Invalid Malaysian phone number format (e.g. 0123456789 or +60123456789).';
      isValid = false;
    }

    // Members check
    const memberInputs = document.querySelectorAll('.member-input');
    memberInputs.forEach((input, index) => {
      if (!input.value.trim()) {
        const errorEl = document.getElementById(`member_${index + 1}_error`);
        if (errorEl) errorEl.textContent = `Member ${index + 2} name is required.`;
        isValid = false;
      }
    });

    // Receipt image check
    if (!receiptBase64 || !receiptContentType) {
      receiptFileError.textContent = 'Please upload your payment receipt.';
      isValid = false;
    }

    return isValid;
  }

  // Handle Form Submission
  preRegForm.addEventListener('submit', async function (e) {
    e.preventDefault();

    if (!validateForm()) return;

    const slug = getSlugFromUrl();
    if (!slug) return;

    // Collect data
    const teamName = document.getElementById('teamName').value.trim();
    const leaderName = document.getElementById('leaderName').value.trim();
    const leaderWhatsApp = document.getElementById('leaderWhatsApp').value.trim();
    
    const memberNames = [];
    document.querySelectorAll('.member-input').forEach(input => {
      memberNames.push(input.value.trim());
    });

    const payload = {
      teamName,
      leaderName,
      leaderWhatsApp,
      memberNames,
      imageBase64: receiptBase64,
      contentType: receiptContentType,
    };

    // UI Loading state
    btnSubmit.disabled = true;
    btnSubmitText.textContent = 'Submitting Registration...';
    btnSpinner.classList.remove('hidden');

    try {
      const appCheckToken = await getAppCheckToken();

      const response = await fetch(`/api/public/events/${encodeURIComponent(slug)}/pre-register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(appCheckToken ? { 'X-Firebase-AppCheck': appCheckToken } : {}),
        },
        body: JSON.stringify(payload),
      });

      const resData = await response.json();

      if (!response.ok || !resData.success) {
        const errMsg = resData.error?.message || 'Failed to submit registration. Please try again.';
        alert(`Error: ${errMsg}`);
        btnSubmit.disabled = false;
        btnSubmitText.textContent = 'Submit Pre-Registration';
        btnSpinner.classList.add('hidden');
        return;
      }

      // Success!
      renderSuccessState(resData.data);
    } catch (err) {
      console.error('Submission error:', err);
      alert('Network Error: Failed to submit registration. Please ensure your internet connection is stable.');
      btnSubmit.disabled = false;
      btnSubmitText.textContent = 'Submit Pre-Registration';
      btnSpinner.classList.add('hidden');
    }
  });

  function renderSuccessState(data) {
    formContainer.classList.add('hidden');
    document.getElementById('summaryTeamName').textContent = data.teamName;
    document.getElementById('summarySubmissionId').textContent = data.submissionId;
    
    const submittedDate = new Date(data.submittedAt || Date.now());
    document.getElementById('summarySubmittedAt').textContent = submittedDate.toLocaleString('en-US');

    successState.classList.remove('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // Initialization
  document.addEventListener('DOMContentLoaded', function () {
    initAppCheck();
    const slug = getSlugFromUrl();
    fetchEventDetails(slug);
  });
})();
