// Adds the top bar + navigation and checks the person is allowed on the page.
//
// Put these on <body>:
//   data-role="admin"   (or "student")  -> page needs that login
//   data-page="belts"                   -> which nav link to highlight
//
// TO ADD A NEW PAGE TO THE MENU: add one line to ADMIN_NAV or STUDENT_NAV below.

const ADMIN_NAV = [
  { page: 'dashboard', label: 'Dashboard', href: '/admin/dashboard.html' },
  { page: 'centres', label: 'Centres', href: '/admin/centres.html' },
  { page: 'classes', label: 'Classes', href: '/admin/classes.html' },
  { page: 'terms', label: 'Term Schedules', href: '/admin/terms.html' },
  { page: 'members', label: 'Members', href: '/admin/members.html' },
  { page: 'belts', label: 'Belts', href: '/admin/belts.html' },
  { page: 'grading', label: 'Grading', href: '/admin/grading.html' },
  { page: 'grading-sessions', label: 'Grading sessions', href: '/admin/grading-sessions.html' },
  { page: 'grading-applications', label: 'Grading applications', href: '/admin/grading-applications.html' },
  { page: 'attendance', label: 'Attendance', href: '/admin/attendance.html' },
  { page: 'fees', label: 'Fees', href: '/admin/fees.html' },
  { page: 'fee-setup', label: 'Fee setup', href: '/admin/fee-setup.html' },  // added by Yu Wen
  { page: 'payments', label: 'Payments', href: '/admin/payments.html' },
  { page: 'reports', label: 'Reports', href: '/admin/reports.html' },
];

const STUDENT_NAV = [
  { page: 'home', label: 'Home', href: '/student/home.html' },
  { page: 'belt', label: 'My belt', href: '/student/belt.html' },
  { page: 'grading', label: 'Grading', href: '/student/grading.html' },
  { page: 'fees', label: 'Fees', href: '/student/fees.html' },
  { page: 'payment-history', label: 'Payment history', href: '/student/payment-history.html' },
];

(function buildLayout() {
  const requiredRole = document.body.dataset.role;
  if (!requiredRole) return; // public page (login/register) - no top bar

  const user = api.getUser();
  if (!api.getToken() || !user) {
    location.replace('/login.html');
    return;
  }
  if (user.role !== requiredRole) {
    location.replace(api.homePageFor(user.role));
    return;
  }

  const nav = requiredRole === 'admin' ? ADMIN_NAV : STUDENT_NAV;
  const current = document.body.dataset.page;
  const links = nav
    .map((n) => `<a href="${n.href}" class="${n.page === current ? 'active' : ''}">${esc(n.label)}</a>`)
    .join('');

  const bar = document.createElement('header');
  bar.className = 'topbar';
  bar.innerHTML = `
    <a class="brand" href="${api.homePageFor(requiredRole)}">Aikido Shinjukai</a>
    <nav>${links}</nav>
    <div class="userchip">
      <span class="avatar">${esc(user.name.charAt(0).toUpperCase())}</span>
      <span>${esc(user.name)}</span>
      <button class="linkbtn" id="logout-btn">Log out</button>
    </div>`;
  document.body.prepend(bar);

  document.getElementById('logout-btn').addEventListener('click', async () => {
    // Always clear the browser session; try server-side token revocation first.
    try { await api.post('/auth/logout', {}); } catch (_) { /* network/offline logout */ }
    api.clearSession();
    location.href = '/login.html';
  });
})();
