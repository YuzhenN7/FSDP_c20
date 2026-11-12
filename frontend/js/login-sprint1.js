/* SCRUM-5: role-based login. Admin is default; no error shown before failed login.
   The tabs remain usable in a static preview even when the backend API helper
   has not been loaded. Actual authentication still requires the Express server. */
(() => {
  const apiClient = typeof api === 'undefined' ? null : api;
  const form = document.querySelector('#login-form');
  const msg = document.querySelector('#login-error');
  const submit = document.querySelector('#submit-login');

  const modes = {
    admin: {
      description: 'Manage student records, training terms and class schedules in one place.',
      benefits: ['Manage student records and belt details', 'Create terms and plan weekly classes', 'Review administrative information'],
      hint: 'Admin access is restricted to authorised headquarters staff.'
    },
    student: {
      description: 'View your training information and track your account.',
      benefits: ['See your current belt', 'Review outstanding fees', 'View payment history'],
      hint: 'Log in using the credentials provided for your account.'
    },
    instructor: {
      description: 'Instructor login is planned for a later sprint.',
      benefits: ['Instructor access is not enabled yet'],
      hint: 'Instructor accounts are not available in Sprint 1. Please use an authorised Admin or Student account.'
    }
  };

  let role = 'admin';
  function hideMessage() {
    msg.hidden = true;
    msg.textContent = '';
  }

  function choose(next) {
    if (!Object.prototype.hasOwnProperty.call(modes, next)) return;
    role = next;
    hideMessage();
    document.querySelectorAll('[data-login-role]').forEach((button) => {
      button.setAttribute('aria-pressed', String(button.dataset.loginRole === role));
    });
    const cfg = modes[role];
    document.querySelector('#role-description').textContent = cfg.description;
    document.querySelector('#benefits').innerHTML = cfg.benefits
      .map((label, i) => `<li><span class="s1-num">${i + 1}</span><span>${label}</span></li>`)
      .join('');
    document.querySelector('#role-hint').textContent = cfg.hint;
    submit.textContent = role === 'instructor' ? 'Instructor login unavailable' : `Log in as ${role}`;
    submit.disabled = role === 'instructor';
    document.querySelector('#email').disabled = role === 'instructor';
    document.querySelector('#password').disabled = role === 'instructor';
  }

  document.querySelectorAll('[data-login-role]').forEach((button) => {
    button.addEventListener('click', () => choose(button.dataset.loginRole));
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    hideMessage();
    if (role === 'instructor') return;
    submit.disabled = true;
    submit.textContent = 'Checking credentials…';
    try {
      if (!apiClient) {
        throw new Error('This page is a visual preview. Start the Express backend to log in.');
      }
      const result = await apiClient.post('/auth/login', {
        email: document.querySelector('#email').value,
        password: document.querySelector('#password').value,
        role
      });
      apiClient.saveSession(result.token, result.user);
      location.replace(apiClient.homePageFor(result.user.role));
    } catch (err) {
      msg.textContent = err.message || 'Unable to log in.';
      msg.hidden = false;
    } finally {
      submit.disabled = role === 'instructor';
      submit.textContent = role === 'instructor' ? 'Instructor login unavailable' : `Log in as ${role}`;
    }
  });

  choose('admin');

  if (apiClient) {
    const existing = apiClient.getUser();
    if (apiClient.getToken() && existing) {
      // Verify server-side: localStorage alone must not grant access.
      apiClient.get('/auth/me')
        .then((user) => location.replace(apiClient.homePageFor(user.role)))
        .catch(() => apiClient.clearSession());
    }
  }
})();
