/* SCRUM-6: admin-only student records UI; all API operations validate server-side.
   - Search + filters: the server filters the list (GET /members?search=&centre_id=&status=)
   - Add / edit: one form inside a popup (<dialog id="member-dialog">)
   - Profile: click a name. The address bar decides what shows:
       members.html = the list,  members.html#student-5 = the profile of student 5 */
(() => {
  const $ = (selector) => document.querySelector(selector);
  const form = $('#member-form');
  const dialog = $('#member-dialog');
  const pageMessage = $('#form-message');
  const formError = $('#modal-message');
  const table = $('#members-table');
  const listPanel = $('#list-panel');
  const profile = $('#profile');
  const field = (name) => form.elements.namedItem(name);

  let shown = [];        // students matching the search + filters (what the table shows)
  let everyone = [];     // every student, ignoring the filters (used by the profile)
  let editingId = null;  // id of the student in the popup form, or null when adding

  // Today's date as YYYY-MM-DD, in the computer's own timezone
  const today = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);

  // ---------- Messages ----------
  function showMessage(text, isError = false) {
    pageMessage.hidden = false;
    pageMessage.textContent = text;
    pageMessage.classList.toggle('error', isError);
  }
  function hideMessage() { pageMessage.hidden = true; pageMessage.textContent = ''; }
  function showFormError(text) { formError.hidden = false; formError.textContent = text; }
  function hideFormError() { formError.hidden = true; formError.textContent = ''; }

  const pill = (status) => `<span class="s1-pill ${esc(status)}">${esc(status)}</span>`;

  // ---------- Age and discount group (from date of birth + concession) ----------
  // Age in whole years today, or null when no date of birth is recorded
  function ageOf(dateOfBirth) {
    if (!dateOfBirth) return null;
    const [y, m, d] = String(dateOfBirth).slice(0, 10).split('-').map(Number);
    const now = new Date();
    let age = now.getFullYear() - y;
    if (now.getMonth() + 1 < m || (now.getMonth() + 1 === m && now.getDate() < d)) age--;
    return age;
  }
  // 'Child' (under 13), 'Senior' (65+), 'Student' (recorded as a full-time student AND aged 17-25), 'NSF', or ''
  function groupOf(s) {
    const age = ageOf(s.date_of_birth);
    if (age !== null && age < 13) return 'Child';
    if (age !== null && age >= 65) return 'Senior';
    if (s.concession === 'nsf') return 'NSF';
    if (s.concession === 'student' && age !== null && age >= 17 && age <= 25) return 'Student';
    return '';
  }
  const ageText = (s) => {
    const age = ageOf(s.date_of_birth);
    const group = groupOf(s);
    return age === null ? '-' : esc(String(age)) + (group ? ` <span class="s1-pill">${esc(group)}</span>` : '');
  };

  // ---------- Load the list (search + filters are applied by the server) ----------
  async function load() {
    const filters = {
      search: $('#search').value.trim(),
      centre_id: $('#filter-dojo').value,
      status: $('#filter-status').value,
    };
    const isFiltered = Boolean(filters.search || filters.centre_id || filters.status);
    const [matches, all] = await Promise.all([
      api.get('/members?' + new URLSearchParams(filters).toString()),
      isFiltered ? api.get('/members') : null,
    ]);
    shown = matches;
    everyone = all || matches;
    drawTable();
    route();
  }
  const reload = () => load().catch((err) => showMessage(err.message, true));

  function drawTable() {
    if (!shown.length) { table.innerHTML = '<p class="empty">No matching students.</p>'; return; }
    table.innerHTML = `<table><thead><tr><th>Name</th><th>Email</th><th>Principal dojo</th><th>Belt</th><th>Age</th><th>Status</th><th>Joined</th><th>Actions</th></tr></thead><tbody>` +
      shown.map((s) => `<tr>
        <td><a class="s1-name-link" href="#student-${Number(s.id)}">${esc(s.name)}</a></td>
        <td>${esc(s.email)}</td>
        <td>${esc(s.centre || 'Not assigned')}</td>
        <td>${esc(s.belt || 'Not assigned')}</td>
        <td>${ageText(s)}</td>
        <td>${pill(s.membership_status)}</td>
        <td>${esc(formatDate(s.joined_on))}</td>
        <td><div class="s1-inline-buttons"><button class="btn small outline" type="button" data-edit="${Number(s.id)}">Edit</button>
        ${s.membership_status !== 'inactive' ? `<button class="btn small outline" type="button" data-deactivate="${Number(s.id)}">Deactivate</button>` : ''}</div></td>
      </tr>`).join('') +
      '</tbody></table>';
  }

  // ---------- One student's profile ----------
  async function showProfile(s) {
    listPanel.hidden = true;
    profile.hidden = false;
    profile.innerHTML = `
      <a class="s1-back" href="#">‹ All students</a>
      <div class="s1-profile-head">
        <h2>${esc(s.name)} ${pill(s.membership_status)}</h2>
        <button class="btn small outline" type="button" data-edit="${Number(s.id)}">Edit</button>
      </div>
      <p class="s1-lead">${esc(s.email)} · ${esc(s.centre || 'No dojo assigned')} · Joined ${esc(formatDate(s.joined_on))}</p>
      <p class="s1-lead">Date of birth: ${s.date_of_birth ? esc(formatDate(s.date_of_birth)) + ' (age ' + ageText(s) + ')' : 'not recorded'}
        · Concession: ${esc({ none: 'none', student: 'full-time student', nsf: 'NSF' }[s.concession] || 'none')}</p>
      <div id="profile-cards">Loading records…</div>`;

    let gradings, fees, attendance;
    try {
      [gradings, fees, attendance] = await Promise.all([
        api.get('/gradings'), api.get('/fees'), api.get('/attendance'),
      ]);
    } catch (err) {
      $('#profile-cards').textContent = err.message;
      return;
    }
    // The admin may have clicked away while the records were loading
    if (location.hash !== '#student-' + s.id) return;

    // Those three lists only give the student's NAME, so two students with the same name
    // cannot be told apart. Better to show nothing than someone else's records.
    if (everyone.filter((other) => other.name === s.name).length > 1) {
      $('#profile-cards').innerHTML = `<p class="s1-note">Records are hidden because more than one student is called
        ${esc(s.name)}, and the grading, fee and attendance lists only identify students by name.</p>`;
      return;
    }

    const mine = (list) => list.filter((row) => row.student === s.name);
    gradings = mine(gradings);       // newest first
    fees = mine(fees);
    attendance = mine(attendance);

    const last = gradings[0];
    const unpaid = fees.filter((f) => f.status === 'unpaid');
    const balance = unpaid.reduce((sum, f) => sum + Number(f.amount), 0);
    const present = attendance.filter((a) => a.status === 'present').length;
    const rate = attendance.length ? Math.round((present / attendance.length) * 100) + '%' : '-';

    $('#profile-cards').innerHTML = `
      <div class="s1-profile-cards">
        <article>
          <h3>Grading</h3>
          <strong>${esc(s.belt || 'Not assigned')}</strong>
          <p>Last grading · ${last ? esc(formatDate(last.graded_on)) : 'No record'}</p>
          ${last ? `<p>${esc(last.belt)} · ${esc(last.result)}</p>` : ''}
        </article>
        <article>
          <h3>Fees</h3>
          <strong>${fees.length === 0 ? 'No fees' : unpaid.length ? 'Outstanding' : 'Paid'}</strong>
          <p>Balance due · ${esc(formatMoney(balance))}</p>
          <p>${fees.length - unpaid.length} of ${fees.length} fees paid</p>
        </article>
        <article>
          <h3>Attendance</h3>
          <strong>${attendance.length ? `${present} / ${attendance.length} classes` : 'No records'}</strong>
          <p>Absent · ${attendance.length - present}</p>
          <p>Attendance rate · ${rate}</p>
        </article>
      </div>`;
  }

  // Decide what to show from the address bar: the list, or one student's profile
  function route() {
    const match = location.hash.match(/^#student-(\d+)$/);
    const student = match && everyone.find((s) => Number(s.id) === Number(match[1]));
    if (student) {
      showProfile(student);
    } else {
      profile.hidden = true;
      listPanel.hidden = false;
    }
  }
  window.addEventListener('hashchange', () => { hideMessage(); route(); });

  // ---------- The popup form (add or edit) ----------
  function openForm(student = null) {
    editingId = student ? Number(student.id) : null;
    form.reset();
    hideFormError();

    // The password is only set when a student is created
    const password = field('password');
    password.required = !student;
    password.disabled = Boolean(student);
    $('#password-row').hidden = Boolean(student);

    if (student) {
      for (const name of ['name', 'email', 'centre_id', 'belt_id', 'membership_status', 'joined_on', 'date_of_birth', 'concession']) {
        const value = student[name] == null ? '' : String(student[name]);
        field(name).value = name === 'joined_on' || name === 'date_of_birth' ? value.slice(0, 10) : value;
      }
      if (!field('concession').value) field('concession').value = 'none';
    } else {
      field('joined_on').value = today();
    }
    $('#form-heading').textContent = student ? 'Edit student' : 'Add a student';
    $('#save-student').textContent = student ? 'Save changes' : 'Create student';
    dialog.showModal();
  }

  $('#add-student').addEventListener('click', () => { hideMessage(); openForm(); });
  $('#close-form').addEventListener('click', () => dialog.close());
  $('#cancel-edit').addEventListener('click', () => dialog.close());

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    hideFormError();
    const payload = {
      name: field('name').value.trim(), email: field('email').value.trim(),
      centre_id: Number(field('centre_id').value), belt_id: Number(field('belt_id').value),
      joined_on: field('joined_on').value, membership_status: field('membership_status').value,
      date_of_birth: field('date_of_birth').value || null, concession: field('concession').value,
    };
    if (!editingId) payload.password = field('password').value;

    const saveButton = $('#save-student');
    saveButton.disabled = true;
    try {
      await (editingId ? api.put(`/members/${editingId}`, payload) : api.post('/members', payload));
      dialog.close();
      showMessage(editingId ? 'Student record updated.' : 'Student created.');
      await load();
    } catch (err) {
      showFormError(err.message);
    } finally {
      saveButton.disabled = false;
    }
  });

  // ---------- Edit / Deactivate buttons (in the table and on the profile) ----------
  async function onActionClick(event) {
    const editButton = event.target.closest('[data-edit]');
    const deactivateButton = event.target.closest('[data-deactivate]');

    if (editButton) {
      const student = everyone.find((s) => Number(s.id) === Number(editButton.dataset.edit));
      if (student) { hideMessage(); openForm(student); }
    }
    if (deactivateButton) {
      const id = Number(deactivateButton.dataset.deactivate);
      const student = everyone.find((s) => Number(s.id) === id);
      if (!student || !confirm(`Deactivate ${student.name}'s membership? Their student login will stop working.`)) return;
      try {
        await api.request('PATCH', `/members/${id}/deactivate`, {});
        showMessage('Student membership deactivated.');
        await load();
      } catch (err) {
        showMessage(err.message, true);
      }
    }
  }
  table.addEventListener('click', onActionClick);
  profile.addEventListener('click', onActionClick);

  // ---------- Search + filters ----------
  $('#search-button').addEventListener('click', reload);
  $('#search').addEventListener('keydown', (event) => { if (event.key === 'Enter') { event.preventDefault(); reload(); } });
  $('#filter-dojo').addEventListener('change', reload);
  $('#filter-status').addEventListener('change', reload);

  // ---------- Start: fill the dropdowns, then load the list ----------
  (async function init() {
    try {
      const options = await api.get('/members/options');
      const optionTags = (rows) => rows.map((r) => `<option value="${Number(r.id)}">${esc(r.name)}</option>`).join('');
      field('centre_id').innerHTML = '<option value="">Select dojo</option>' + optionTags(options.centres);
      // Belts grouped by ladder: adults (13 and above) and juniors (under 13)
      const ladder = (track) => options.belts.filter((b) => (b.track || 'adult') === track);
      field('belt_id').innerHTML = '<option value="">Select current belt</option>' +
        `<optgroup label="Adult ladder (13 and above)">${optionTags(ladder('adult'))}</optgroup>` +
        `<optgroup label="Junior ladder (under 13)">${optionTags(ladder('junior'))}</optgroup>`;
      $('#filter-dojo').innerHTML = '<option value="">All dojos</option>' + optionTags(options.centres);
      await load();
    } catch (err) {
      showMessage(err.message, true);
      table.textContent = err.message;
    }
  })();
})();