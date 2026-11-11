// Admin: list of students, and one student's profile. Used by frontend/admin/members.html
// Needs api.js, ui.js and layout.js loaded first.
//
// The list comes from GET /api/members.
// The profile cards are worked out from GET /api/gradings, /api/fees and /api/attendance.
// The address bar decides what shows:  members.html = the list,  members.html#5 = student with id 5.

(function () {
  const $ = (id) => document.getElementById(id);

  let members = [];     // [{ id, name, email, centre, belt, joined_on }]
  let records = null;   // { gradings, fees, attendance } - loaded the first time a profile is opened

  // ---------- The list ----------
  function showDirectory() {
    $('title').textContent = 'Students';
    $('filters').hidden = false;
    $('directory').hidden = false;
    $('profile').hidden = true;

    const centre = $('centre').value;
    const shown = members.filter((m) => !centre || m.centre === centre);

    renderTable('#directory', [
      { label: 'Name', render: (m) => `<a href="#${esc(m.id)}">${esc(m.name)}</a>` },
      { label: 'Email', key: 'email' },
      { label: 'Main centre', key: 'centre' },
      { label: 'Grade', key: 'belt' },
      { label: 'Joined', render: (m) => esc(formatDate(m.joined_on)) },
    ], shown);
  }

  // ---------- One student's profile ----------
  async function showProfile(member) {
    $('title').textContent = member.name;
    $('filters').hidden = true;
    $('directory').hidden = true;
    $('profile').hidden = false;
    $('profile').innerHTML = `
      <a href="#">‹ All students</a>
      <p class="muted">${esc(member.email)} · ${esc(member.centre || 'No centre')} · Joined ${esc(formatDate(member.joined_on))}</p>
      <div id="profile-cards">Loading...</div>`;

    try {
      if (!records) {
        const [gradings, fees, attendance] = await Promise.all([
          api.get('/gradings'), api.get('/fees'), api.get('/attendance'),
        ]);
        records = { gradings, fees, attendance };
      }
    } catch (err) {
      showError('#profile-cards', err);
      return;
    }
    // The admin may have clicked away while the records were loading
    if (location.hash.slice(1) !== String(member.id)) return;

    // Those three lists only give the student's NAME, so two students with the same name
    // cannot be told apart. Better to show nothing than someone else's records.
    if (members.filter((m) => m.name === member.name).length > 1) {
      $('profile-cards').innerHTML = `<p class="note">Records are hidden because more than one student is called
        ${esc(member.name)}, and the grading, fee and attendance lists only identify students by name.</p>`;
      return;
    }

    const mine = (list) => list.filter((row) => row.student === member.name);
    const gradings = mine(records.gradings);   // newest first
    const fees = mine(records.fees);
    const attendance = mine(records.attendance);

    const last = gradings[0];
    const unpaid = fees.filter((f) => f.status === 'unpaid');
    const balance = unpaid.reduce((sum, f) => sum + Number(f.amount), 0);
    const present = attendance.filter((a) => a.status === 'present').length;
    const rate = attendance.length ? Math.round((present / attendance.length) * 100) : 0;

    $('profile-cards').innerHTML = `
      <div class="profile-cards">
        <article>
          <h2>Grading</h2>
          <strong>${esc(member.belt || 'Not set')}</strong>
          <p>Last grading · ${last ? esc(formatDate(last.graded_on)) : 'No record'}</p>
          ${last ? `<p>${esc(last.belt)} · ${statusBadge(last.result)}</p>` : ''}
        </article>
        <article>
          <h2>Fees</h2>
          <strong>${fees.length === 0 ? 'No fees' : unpaid.length ? 'Outstanding' : 'Paid'}</strong>
          <p>Balance due · ${esc(formatMoney(balance))}</p>
          <p>${fees.length - unpaid.length} of ${fees.length} fees paid</p>
        </article>
        <article>
          <h2>Attendance</h2>
          <strong>${attendance.length ? `${present} / ${attendance.length} classes` : 'No records'}</strong>
          <p>Absent · ${attendance.length - present}</p>
          <p>Attendance rate · ${attendance.length ? rate + '%' : '-'}</p>
        </article>
      </div>`;
  }

  // ---------- Decide what to show from the address bar ----------
  function route() {
    const member = members.find((m) => String(m.id) === location.hash.slice(1));
    if (member) showProfile(member);
    else showDirectory();
  }

  window.addEventListener('hashchange', route);
  $('centre').addEventListener('change', showDirectory);

  // ---------- Start ----------
  (async function load() {
    try {
      const [memberList, centres] = await Promise.all([api.get('/members'), api.get('/centres')]);
      members = memberList;
      $('centre').innerHTML = '<option value="">All centres</option>' +
        centres.map((c) => `<option>${esc(c.name)}</option>`).join('');
      route();
    } catch (err) {
      showError('#directory', err);
    }
  })();
})();