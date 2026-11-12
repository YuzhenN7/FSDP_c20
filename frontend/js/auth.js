// Login page. Used by frontend/login.html
// Needs api.js loaded first.
// Admins and students use the same form: the account's role decides where they land.

(function () {
  // Already logged in? Go straight to your home page.
  const existing = api.getUser();
  if (api.getToken() && existing) {
    location.replace(api.homePageFor(existing.role));
    return;
  }

  const form = document.getElementById('login-form');
  const errorBox = document.getElementById('error');
  const button = document.getElementById('login-btn');

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    errorBox.textContent = '';
    button.disabled = true;
    try {
      const result = await api.post('/auth/login', {
        email: document.getElementById('email').value,
        password: document.getElementById('password').value,
      });
      api.saveSession(result.token, result.user);
      location.href = api.homePageFor(result.user.role);
    } catch (err) {
      errorBox.textContent = err.message;
      button.disabled = false;
    }
  });
})();