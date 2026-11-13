(() => {
  const $ = (selector) => document.querySelector(selector);

  const ROLES = {
    admin: {
      button: 'Log in as admin',
      hint: 'Admin access is restricted to authorised headquarters staff.',
      description: 'Manage student records, training terms and class schedules in one place.',
      benefits: [
        'Manage student records and belt details',
        'Create terms and plan weekly classes',
        'Review administrative information',
      ],
    },
    student: {
      button: 'Log in as student',
      hint: 'Use the email you registered with.',
      description: 'See your belt, your classes and pay your fees online.',
      benefits: [
        'View your belt and grading history',
        'Pay your fees online',
        'Check your payment history and receipts',
      ],
    },
    instructor: {
      button: 'Log in as instructor',
      hint: 'Instructor accounts are created by headquarters.',
      description: 'See your classes and record attendance.',
      benefits: [
        'View your weekly classes',
        'Record attendance',
        'See your students',
      ],
    },
  };

  let role = 'admin';
  const errorBox = $('#login-error');

  function showError(text) {
    errorBox.hidden = false;
    errorBox.textContent = text;
  }
  function hideError() {
    errorBox.hidden = true;
    errorBox.textContent = '';
  }

  function setRole(next) {
    role = next;
    hideError();
    document.querySelectorAll('[data-login-role]').forEach((b) => {
      b.setAttribute('aria-pressed', String(b.dataset.loginRole === next));
    });
    const r = ROLES[next];
    $('#submit-login').textContent = r.button;
    $('#role-hint').textContent = r.hint;
    $('#role-description').textContent = r.description;
    $('#benefits').innerHTML = r.benefits
      .map((text, i) => `<li><span class="s1-num">${i + 1}</span>${text}</li>`)
      .join('');
  }

  document.querySelectorAll('[data-login-role]').forEach((b) => {
    b.addEventListener('click', () => setRole(b.dataset.loginRole));
  });

  // Already logged in? Go straight to your home page.
  const existing = api.getUser();
  if (api.getToken() && existing) {
    location.replace(api.homePageFor(existing.role));
    return;
  }

  $('#login-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    hideError();
    const button = $('#submit-login');
    button.disabled = true;
    try {
      const result = await api.post('/auth/login', {
        email: $('#email').value.trim(),
        password: $('#password').value,
        role,
      });
      // The tab you picked must match the account
      if (result.user.role !== role) {
        api.clearSession();
        showError(`This account is not a${role === 'admin' ? 'n' : ''} ${role} account. Choose the right tab.`);
        return;
      }
      api.saveSession(result.token, result.user);
      location.href = api.homePageFor(result.user.role);
    } catch (err) {
      showError(err.message);
    } finally {
      button.disabled = false;
    }
  });

  setRole('admin');
})();