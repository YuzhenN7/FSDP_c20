const ADMIN_NAV = [
  { page: 'dashboard', label: 'Dashboard', href: '/admin/dashboard.html' },
  { label: 'Dojos & classes', children: [
    { page: 'centres', label: 'Centres', href: '/admin/centres.html' },
    { page: 'classes', label: 'Classes', href: '/admin/classes.html' },
    { page: 'terms', label: 'Term Schedules', href: '/admin/terms.html' },
    { page: 'attendance', label: 'Attendance', href: '/admin/attendance.html' },
  ] },
  { label: 'Members', children: [
    { page: 'members', label: 'Members', href: '/admin/members.html' },
    { page: 'belts', label: 'Belts', href: '/admin/belts.html' },
  ] },
  { label: 'Gradings', children: [
    { page: 'grading', label: 'Results', href: '/admin/grading.html' },
    { page: 'grading-sessions', label: 'Sessions', href: '/admin/grading-sessions.html' },
    { page: 'grading-applications', label: 'Applications', href: '/admin/grading-applications.html' },
  ] },
  { label: 'Fees & payments', children: [
    { page: 'fees', label: 'Fees', href: '/admin/fees.html' },
    { page: 'fee-setup', label: 'Fee setup', href: '/admin/fee-setup.html' },  // added by Yu Wen
    { page: 'payments', label: 'Payments', href: '/admin/payments.html' },
  ] },
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
  if (!requiredRole) return; 

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
  const linkHtml = (n) => `<a href="${n.href}" class="${n.page === current ? 'active' : ''}">${esc(n.label)}</a>`;

  const links = nav
    .map((n) => {
      if (!n.children) return linkHtml(n);
      const here = n.children.some((c) => c.page === current);
      return `<div class="dd">
        <button type="button" class="dd-btn ${here ? 'active' : ''}" aria-haspopup="true" aria-expanded="false">${esc(n.label)} \u25BE</button>
        <div class="dd-menu">${n.children.map(linkHtml).join('')}</div>
      </div>`;
    })
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

  // dropdown menus
  function closeMenus(except) {
    bar.querySelectorAll('.dd.open').forEach((dd) => {
      if (dd !== except) {
        dd.classList.remove('open');
        dd.querySelector('.dd-btn').setAttribute('aria-expanded', 'false');
      }
    });
  }
  bar.addEventListener('click', (e) => {
    const btn = e.target.closest('.dd-btn');
    if (!btn) return;
    const dd = btn.parentElement;
    closeMenus(dd);
    const open = dd.classList.toggle('open');
    btn.setAttribute('aria-expanded', String(open));
  });
  document.addEventListener('click', (e) => { if (!bar.contains(e.target)) closeMenus(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeMenus(); });

  document.getElementById('logout-btn').addEventListener('click', async () => {
    // Always clear the browser session; try server-side token revocation first.
    try { await api.post('/auth/logout', {}); } catch (_) { /* network/offline logout */ }
    api.clearSession();
    location.href = '/login.html';
  });
})();