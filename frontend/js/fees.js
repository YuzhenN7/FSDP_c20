// Admin Fees page. Used by frontend/admin/fees.html. Needs api.js, ui.js and layout.js loaded first.
//
// The page has three views (only one shows at a time):
//   list    - every charge, with filters. Each unpaid charge can be settled, edited or voided.
//   grading - raise grading fees in bulk for approved grading applicants
//   counter - record money taken at the dojo (creates the charge already paid)
// and four pop-ups: settle, edit, void, add late fee.
//
// API (all in backend/routes/feeRoutes.js):
//   GET  /fees?centre_id=&status=&search=     GET /fees/options     GET /fees/grading-applicants
//   POST /fees/grading    POST /fees/counter    POST /fees (late fee)
//   POST /fees/:id/settle    PUT /fees/:id    POST /fees/:id/void

(function () {
  const $ = (id) => document.getElementById(id);

  // ---------- Data from the API ----------
  let options = { centres: [], students: [], fee_types: [], packages: [] };
  let fees = [];            // the charges in the list (already filtered by the server)
  let belts = [];           // every belt level, to name the grade bands
  let applicants = [];      // approved grading applications not charged yet
  let sessions = [];        // grading sessions, for the filter
  let current = null;       // the charge a pop-up is about

  // ---------- Small helpers ----------
  // Today as YYYY-MM-DD in the computer's own timezone, optionally some days ahead
  function today(daysAhead = 0) {
    const d = new Date(Date.now() + daysAhead * 86400000);
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  }
  const money = (value) => formatMoney(Number(value) || 0);
  const METHOD_NAMES = { cash: 'Cash', paynow: 'PayNow', card: 'NETS / card', online: 'Online' };
  const methodName = (m) => METHOD_NAMES[m] || m || '';
  const optionTags = (rows, label = (r) => r.name) =>
    rows.map((r) => `<option value="${esc(r.id)}">${esc(label(r))}</option>`).join('');

  // Age in whole years today, or null when no date of birth is recorded
  function ageOf(dateOfBirth) {
    if (!dateOfBirth) return null;
    const [y, m, d] = String(dateOfBirth).slice(0, 10).split('-').map(Number);
    const now = new Date();
    let age = now.getFullYear() - y;
    if (now.getMonth() + 1 < m || (now.getMonth() + 1 === m && now.getDate() < d)) age--;
    return age;
  }
  // 'Child' (under 13), 'Senior' (65+), 'NSF', 'Student' (recorded as a full-time student AND aged 17-25), or ''
  function groupOf(person) {
    const age = ageOf(person.date_of_birth);
    if (age !== null && age < 13) return 'Child';
    if (age !== null && age >= 65) return 'Senior';
    if (person.concession === 'nsf') return 'NSF';
    if (person.concession === 'student' && age !== null && age >= 17 && age <= 25) return 'Student';
    return '';
  }
  const tag = (label) => (label ? `<span class="tag">${esc(label)}</span>` : '');

  // ---------- Messages and views ----------
  function say(text, isError = false) {
    const box = $('msg');
    box.hidden = !text;
    box.textContent = text || '';
    box.classList.toggle('bad', isError);
    if (text) window.scrollTo({ top: 0 });
  }

  function show(view) {
    for (const name of ['list', 'grading', 'counter']) $('view-' + name).hidden = name !== view;
    window.scrollTo({ top: 0 });
  }

  // =====================================================================
  // 1. The list of charges
  // =====================================================================
  async function loadFees() {
    const filters = new URLSearchParams({
      centre_id: $('f-centre').value, status: $('f-status').value, search: $('f-search').value.trim(),
    });
    fees = await api.get('/fees?' + filters.toString());
    drawFees();
  }
  const reloadFees = () => loadFees().catch((err) => say(err.message, true));

  // The small grey line under the charge: how it was paid, or who voided it
  function detailLine(f) {
    if (f.status === 'paid' && f.paid_method) {
      const where = f.paid_method === 'online' ? 'Online' : 'Counter · ' + methodName(f.paid_method);
      return `${where}${f.paid_reference ? ' · ' + f.paid_reference : ''} · ${formatDate(f.paid_at)}`;
    }
    if (f.status === 'void') {
      return `Voided by ${f.voided_by || 'an admin'}, ${formatDate(f.voided_at)} · ${f.void_reason || ''}`;
    }
    return '';
  }

  function drawFees() {
    $('f-count').textContent = fees.length + (fees.length === 1 ? ' charge' : ' charges');
    if (fees.length === 0) {
      $('fees-table').innerHTML = '<div class="empty">No charges match.</div>';
      return;
    }
    const rows = fees.map((f) => {
      const detail = detailLine(f);
      const actions = f.status === 'unpaid'
        ? `<div class="row-actions">
             <button type="button" data-act="settle" data-id="${Number(f.id)}">Settle</button>
             <button type="button" data-act="edit" data-id="${Number(f.id)}">Edit</button>
             <button type="button" class="danger" data-act="void" data-id="${Number(f.id)}">Void</button>
           </div>`
        : (f.status === 'paid' ? '<div class="row-actions"><span class="locked">Locked</span></div>' : '');
      return `<tr class="${f.status === 'void' ? 'is-void' : ''}">
        <td>${esc(f.student)}<span class="sub">${esc(f.centre || 'No centre')} · balance ${esc(money(f.balance))}</span></td>
        <td>${esc(f.description)}${detail ? `<span class="sub">${esc(detail)}</span>` : ''}</td>
        <td class="num amount">${esc(money(f.amount))}</td>
        <td>${esc(formatDate(f.due_date))}</td>
        <td><span class="badge ${esc(f.display_status)}">${esc(f.display_status)}</span></td>
        <td>${actions}</td>
      </tr>`;
    }).join('');
    $('fees-table').innerHTML = `<div class="fees-scroll"><table class="fees-table">
      <thead><tr><th>Student</th><th>Charge</th><th class="num">Amount</th><th>Due</th><th>Status</th><th></th></tr></thead>
      <tbody>${rows}</tbody></table></div>`;
  }

  $('f-centre').addEventListener('change', reloadFees);
  $('f-status').addEventListener('change', reloadFees);
  let searchTimer = null;
  $('f-search').addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(reloadFees, 300);     // wait until the admin stops typing
  });

  // =====================================================================
  // Pop-ups: settle, edit, void (one charge) and add late fee
  // =====================================================================
  const aboutFee = (f) => `${f.student} · ${f.description} · ${money(f.amount)}`;

  // Open a pop-up: clear it, fill the "about" line, then let `fill` set the starting values
  function openDialog(id, about, fill) {
    const dialog = $(id);
    const form = dialog.querySelector('form');
    form.reset();
    dialog.querySelector('[data-error]').textContent = '';
    const aboutLine = dialog.querySelector('[data-about]');
    if (aboutLine && about) aboutLine.textContent = about;
    if (fill) fill(form.elements);
    dialog.showModal();
  }

  // What happens when a pop-up's form is submitted. `send(fields)` does the API call and returns the success message.
  function onDialogSubmit(id, send) {
    const dialog = $(id);
    const form = dialog.querySelector('form');
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const error = dialog.querySelector('[data-error]');
      const button = form.querySelector('button[type="submit"]');
      error.textContent = '';
      button.disabled = true;
      try {
        const message = await send(form.elements);
        dialog.close();
        say(message);
        await Promise.all([loadFees(), loadOptions()]);     // balances changed
      } catch (err) {
        error.textContent = err.message;
      } finally {
        button.disabled = false;
      }
    });
    dialog.querySelector('[data-close]').addEventListener('click', () => dialog.close());
  }

  $('fees-table').addEventListener('click', (event) => {
    const button = event.target.closest('button[data-act]');
    if (!button) return;
    current = fees.find((f) => Number(f.id) === Number(button.dataset.id));
    if (!current) return;
    say('');

    if (button.dataset.act === 'settle') {
      openDialog('dlg-settle', aboutFee(current), (el) => { el.paid_on.value = today(); el.paid_on.max = today(); });
    }
    if (button.dataset.act === 'edit') {
      openDialog('dlg-edit', `${current.student} · ${current.description}`, (el) => {
        el.amount.value = Number(current.amount).toFixed(2);
        el.due_date.value = current.due_date ? String(current.due_date).slice(0, 10) : '';
      });
    }
    if (button.dataset.act === 'void') {
      const me = api.getUser();
      openDialog('dlg-void', aboutFee(current), (el) => {
        el.who.value = (me && me.name) || 'You';
        el.when.value = new Date().toLocaleString('en-SG', { dateStyle: 'medium', timeStyle: 'short' });
      });
    }
  });

  onDialogSubmit('dlg-settle', async (el) => {
    await api.post(`/fees/${current.id}/settle`, {
      method: el.method.value, reference: el.reference.value.trim(), paid_on: el.paid_on.value || null,
    });
    return `${current.student}'s charge of ${money(current.amount)} is marked as paid.`;
  });

  onDialogSubmit('dlg-edit', async (el) => {
    await api.put(`/fees/${current.id}`, {
      amount: el.amount.value, due_date: el.due_date.value || null, reason: el.reason.value.trim(),
    });
    return 'Charge updated.';
  });

  onDialogSubmit('dlg-void', async (el) => {
    await api.post(`/fees/${current.id}/void`, { reason: el.reason.value.trim(), password: el.password.value });
    return `Charge voided: ${current.student}, ${current.description}.`;
  });

  // ---------- Add late fee ----------
  const lateType = () => options.fee_types.find((t) => t.category === 'late_fee');
  const studentsAt = (centreId) => options.students.filter((s) => !centreId || String(s.centre_id) === String(centreId));
  const studentLabel = (s) => `${s.name}${s.belt ? ' (' + s.belt + ')' : ''}`;

  $('open-late').addEventListener('click', () => {
    say('');
    openDialog('dlg-late', null, (el) => {
      el.centre.innerHTML = '<option value="">All centres</option>' + optionTags(options.centres);
      el.student.innerHTML = '<option value="">Choose a student...</option>' + optionTags(studentsAt(''), studentLabel);
      const type = lateType();
      el.amount.value = type && type.base_amount != null ? Number(type.base_amount).toFixed(2) : '';
      el.due_date.value = today(7);
    });
  });
  $('dlg-late').querySelector('[name="centre"]').addEventListener('change', (event) => {
    $('dlg-late').querySelector('[name="student"]').innerHTML =
      '<option value="">Choose a student...</option>' + optionTags(studentsAt(event.target.value), studentLabel);
  });

  onDialogSubmit('dlg-late', async (el) => {
    if (!el.student.value) throw new Error('Choose a student.');
    const type = lateType();
    await api.post('/fees', {
      student_ids: [Number(el.student.value)],
      description: type ? type.name : 'Late Submission Fee',
      amount: el.amount.value, due_date: el.due_date.value,
    });
    return 'Late fee added.';
  });

  // =====================================================================
  // 2. Raise grading fees
  // =====================================================================
  // A band = belts next to each other on one ladder that share a grading fee, e.g. "4th kyu to 3rd kyu ($65.00)"
  function gradeBands() {
    const bands = [];
    for (const belt of belts) {
      if (belt.grading_fee == null) continue;
      const last = bands[bands.length - 1];
      if (last && last.track === belt.track && Number(last.fee) === Number(belt.grading_fee)) {
        last.to = belt.name;
      } else {
        bands.push({ track: belt.track, fee: belt.grading_fee, from: belt.name, to: belt.name });
      }
    }
    return bands.map((b) => ({
      track: b.track,
      key: b.track + '|' + Number(b.fee),
      label: `${b.from === b.to ? b.from : b.from + ' to ' + b.to} (${money(b.fee)})`,
    }));
  }
  const bandKey = (a) => (a.grading_fee == null ? '' : a.track + '|' + Number(a.grading_fee));
  // For the Group filter: everyone who is not a child, senior, student or NSF counts as 'Adult'
  const applicantGroup = (a) => groupOf(a) || 'Adult';

  // Fill the Grade band dropdown with the bands of the chosen ladder only (all bands when no ladder is chosen).
  // The chosen band is kept if it is still in the list, otherwise it goes back to "All bands".
  function drawBandOptions() {
    const track = $('g-track').value;
    const chosen = $('g-band').value;
    const bands = gradeBands().filter((b) => !track || b.track === track);
    $('g-band').innerHTML = '<option value="">All bands</option>' +
      bands.map((b) => `<option value="${esc(b.key)}">${esc(b.label)}</option>`).join('');
    $('g-band').value = bands.some((b) => b.key === chosen) ? chosen : '';
  }
  const sessionLabel = (s) =>
    `${{ mass_adult: 'Mass grading (adults)', mass_children: 'Mass grading (children)', private: 'Private grading' }[s.type] || s.type}` +
    ` · ${formatDate(s.session_date)} · ${s.centre}`;

  // The applicants that match the four filters
  function shownApplicants() {
    const session = $('g-session').value;
    const track = $('g-track').value;
    const band = $('g-band').value;
    const group = $('g-group').value;
    return applicants.filter((a) =>
      (!session || String(a.session_id) === session) &&
      (!track || a.track === track) &&
      (!band || bandKey(a) === band) &&
      (!group || (group === 'Private' ? a.session_type === 'private' : applicantGroup(a) === group)));
  }
  const chargeable = (a) => a.target_belt && a.grading_fee != null;
  const tickedApplicants = () => {
    const ticked = new Set([...document.querySelectorAll('#g-list input:checked')].map((box) => Number(box.value)));
    return applicants.filter((a) => ticked.has(Number(a.application_id)));
  };

  function drawApplicants(keepTicked = new Set()) {
    const list = shownApplicants();
    $('g-count').textContent = `· ${list.length} not yet charged`;
    $('g-all').hidden = list.filter(chargeable).length === 0;
    if (list.length === 0) {
      $('g-list').innerHTML = `<div class="empty">${applicants.length === 0
        ? 'No approved grading applications are waiting to be charged.'
        : 'No applicants match these filters.'}</div>`;
    } else {
      $('g-list').innerHTML = list.map((a) => {
        const id = Number(a.application_id);
        const feeCell = !a.target_belt ? '<span class="fee none">top belt</span>'
          : a.grading_fee == null ? '<span class="fee none">no fee set</span>'
            : `<span class="fee">${esc(money(a.grading_fee))}</span>`;
        return `<label>
          <input type="checkbox" value="${id}" ${chargeable(a) ? '' : 'disabled'} ${keepTicked.has(id) && chargeable(a) ? 'checked' : ''}>
          <span class="who">${esc(a.student)}${tag(groupOf(a))}${a.session_type === 'private' ? tag('Private') : ''}</span>
          <span class="grade">${esc(a.current_belt || 'No belt')} &rarr; ${esc(a.target_belt || 'none')}</span>
          ${feeCell}
        </label>`;
      }).join('');
    }
    drawGradingSummary();
  }

  function drawGradingSummary() {
    const chosen = tickedApplicants();
    const byBand = new Map();      // band label -> { count, fee }
    const labels = Object.fromEntries(gradeBands().map((b) => [b.key, b.label.replace(/ \(\$.*\)$/, '')]));
    for (const a of chosen) {
      const label = labels[bandKey(a)] || a.target_belt;
      const entry = byBand.get(label) || { count: 0, fee: Number(a.grading_fee) };
      entry.count++;
      byBand.set(label, entry);
    }
    const total = chosen.reduce((sum, a) => sum + Number(a.grading_fee), 0);
    $('g-summary').innerHTML =
      [...byBand].map(([label, e]) => `<div class="sum-row"><span>${esc(label)}</span><span>${e.count} × ${esc(money(e.fee))}</span></div>`).join('') +
      `<div class="sum-row total"><span>Total raised</span><span>${esc(money(total))}</span></div>`;
    $('g-submit').disabled = chosen.length === 0;
    $('g-submit').textContent = chosen.length === 0 ? 'Raise charges'
      : `Raise ${chosen.length} charge${chosen.length === 1 ? '' : 's'}`;
    $('g-all').textContent = `Select all ${shownApplicants().filter(chargeable).length}`;
  }

  async function openGrading() {
    say('');
    const data = await api.get('/fees/grading-applicants');
    applicants = data.applicants;
    sessions = data.sessions;
    $('g-session').innerHTML = '<option value="">All sessions</option>' + optionTags(sessions, sessionLabel);
    $('g-track').value = '';
    drawBandOptions();
    $('g-group').value = '';
    $('g-due').value = today(14);
    $('g-error').textContent = data.available ? '' : 'Grading sessions are not set up in this database yet.';
    drawApplicants();
    show('grading');
  }

  for (const id of ['g-session', 'g-track', 'g-band', 'g-group']) {
    $(id).addEventListener('change', () => {
      if (id === 'g-track') drawBandOptions();     // a different ladder has different bands
      // keep the ticks of applicants that are still showing
      drawApplicants(new Set(tickedApplicants().map((a) => Number(a.application_id))));
    });
  }
  $('g-list').addEventListener('change', drawGradingSummary);
  $('g-all').addEventListener('click', () => {
    document.querySelectorAll('#g-list input:not(:disabled)').forEach((box) => { box.checked = true; });
    drawGradingSummary();
  });

  $('g-submit').addEventListener('click', async () => {
    const chosen = tickedApplicants();
    $('g-error').textContent = '';
    if (!$('g-due').value) { $('g-error').textContent = 'Enter a due date.'; return; }
    $('g-submit').disabled = true;
    try {
      const result = await api.post('/fees/grading', {
        application_ids: chosen.map((a) => Number(a.application_id)), due_date: $('g-due').value,
      });
      const skipped = result.skipped.length
        ? ` Skipped: ${result.skipped.map((s) => `${s.student} (${s.reason})`).join(', ')}` : '';
      await Promise.all([loadFees(), loadOptions()]);
      show('list');
      say(`${result.created} grading fee${result.created === 1 ? '' : 's'} raised.${skipped}`);
    } catch (err) {
      $('g-error').textContent = err.message;
      $('g-submit').disabled = false;
    }
  });

  // =====================================================================
  // 3. Record a counter payment
  // =====================================================================
  const CATEGORY_TITLES = {
    registration: 'Registration', membership: 'Membership', class_package: 'Training passes',
    grading: 'Grading', late_fee: 'Late fee', other: 'Trial, casual and guests',
  };
  const counterStudent = () => options.students.find((s) => String(s.id) === $('c-student').value);

  // The ticked fee types with the amount typed beside each: [{ type, amount }]
  function tickedItems() {
    return [...document.querySelectorAll('#c-items input[type="checkbox"]:checked')].map((box) => ({
      type: options.fee_types.find((t) => String(t.id) === box.value),
      amount: Number(document.querySelector(`#c-items input[data-amount="${box.value}"]`).value),
    }));
  }

  function drawCounterItems() {
    let lastCategory = null;
    $('c-items').innerHTML = options.fee_types.map((t) => {
      const title = t.category !== lastCategory
        ? `<div class="group-title">${esc(CATEGORY_TITLES[t.category] || t.category)}</div>` : '';
      lastCategory = t.category;
      return `${title}<label>
        <input type="checkbox" value="${Number(t.id)}">
        <span class="who">${esc(t.name)}${t.description ? ` <span class="muted" style="font-size:12.5px">· ${esc(t.description)}</span>` : ''}</span>
        <input class="amount-box" type="number" min="0.01" step="0.01" data-amount="${Number(t.id)}" data-base="${t.base_amount == null ? '' : Number(t.base_amount)}"
               value="${t.base_amount == null ? '' : Number(t.base_amount).toFixed(2)}" placeholder="Amount" aria-label="Amount for ${esc(t.name)}">
      </label>`;
    }).join('');
  }

  // Put every amount back to its list price, less the concession on training passes
  // and less the package discount on the fee types inside the chosen package.
  function applyPrices() {
    const concession = Number($('c-discount').value);
    const pack = options.packages.find((p) => String(p.id) === $('c-package').value);
    for (const input of document.querySelectorAll('#c-items input[data-amount]')) {
      if (input.dataset.base === '') continue;                      // no list price (grading fee): leave what was typed
      const type = options.fee_types.find((t) => String(t.id) === input.dataset.amount);
      let price = Number(input.dataset.base);
      if (pack && pack.fee_type_ids.includes(type.id)) price *= 1 - Number(pack.discount_percent) / 100;
      if (type.category === 'class_package') price *= 1 - concession / 100;
      input.value = price.toFixed(2);
    }
    drawCounterSummary();
  }

  function drawCounterSummary() {
    const items = tickedItems();
    const student = counterStudent();
    const total = items.reduce((sum, item) => sum + (item.amount || 0), 0);
    $('c-summary').innerHTML =
      (student ? `<div class="sum-row"><span>Student</span><span>${esc(student.name)}</span></div>` : '') +
      items.map((item) => `<div class="sum-row"><span>${esc(item.type.name)}</span><span>${item.amount > 0 ? esc(money(item.amount)) : 'enter amount'}</span></div>`).join('') +
      `<div class="sum-row"><span>Paid by</span><span>${esc(methodName($('c-method').value))}</span></div>` +
      `<div class="sum-row total"><span>Total received</span><span>${esc(money(total))}</span></div>`;
    $('c-submit').disabled = !student || items.length === 0;
  }

  function drawCounterStudents() {
    $('c-student').innerHTML = '<option value="">Choose a student...</option>' +
      optionTags(studentsAt($('c-centre').value), studentLabel);
    onCounterStudent();
  }

  function onCounterStudent() {
    const s = counterStudent();
    if (!s) {
      $('c-about').textContent = 'Choose a student to see their belt and balance.';
    } else {
      const group = groupOf(s);
      $('c-about').innerHTML = `${esc(s.belt || 'No belt')} · balance ${esc(money(s.balance))}` +
        (group ? ` · ${tag(group)}` : '');
      // Suggest the concession the student qualifies for (the admin can change it)
      $('c-discount').value = group === 'Senior' ? '40' : (group === 'Student' || group === 'NSF') ? '50' : '0';
      applyPrices();
    }
    drawCounterSummary();
  }

  function openCounter() {
    say('');
    $('c-centre').innerHTML = '<option value="">All centres</option>' + optionTags(options.centres);
    $('c-package').innerHTML = '<option value="">Choose a package...</option>' +
      optionTags(options.packages, (p) => p.name + (Number(p.discount_percent) ? ` (${Number(p.discount_percent)}% off)` : ''));
    $('c-discount').value = '0';
    $('c-method').value = 'cash';
    $('c-reference').value = '';
    $('c-error').textContent = '';
    drawCounterItems();
    drawCounterStudents();
    show('counter');
  }

  $('c-centre').addEventListener('change', drawCounterStudents);
  $('c-student').addEventListener('change', onCounterStudent);
  $('c-discount').addEventListener('change', applyPrices);
  $('c-method').addEventListener('change', drawCounterSummary);
  $('c-package').addEventListener('change', () => {
    const pack = options.packages.find((p) => String(p.id) === $('c-package').value);
    if (pack) {
      // tick exactly the fee types inside the package
      document.querySelectorAll('#c-items input[type="checkbox"]').forEach((box) => {
        box.checked = pack.fee_type_ids.includes(Number(box.value));
      });
    }
    applyPrices();
  });
  $('c-items').addEventListener('input', drawCounterSummary);
  $('c-items').addEventListener('change', drawCounterSummary);

  $('c-submit').addEventListener('click', async () => {
    const student = counterStudent();
    const items = tickedItems();
    const discount = Number($('c-discount').value);
    $('c-error').textContent = '';
    if (items.some((item) => !(item.amount > 0))) {
      $('c-error').textContent = 'Enter an amount above 0 for every ticked fee.';
      return;
    }
    $('c-submit').disabled = true;
    try {
      const result = await api.post('/fees/counter', {
        student_id: Number(student.id),
        items: items.map((item) => ({
          // note the concession on the charge so the lower amount is explained
          description: item.type.name +
            (discount && item.type.category === 'class_package' ? ` (${discount}% concession)` : ''),
          amount: item.amount,
        })),
        method: $('c-method').value,
        reference: $('c-reference').value.trim(),
      });
      await Promise.all([loadFees(), loadOptions()]);
      show('list');
      say(`Counter payment recorded: ${money(result.total)} from ${student.name} (${result.created} fee${result.created === 1 ? '' : 's'}).`);
    } catch (err) {
      $('c-error').textContent = err.message;
      $('c-submit').disabled = false;
    }
  });

  // =====================================================================
  // Moving between views, and starting the page
  // =====================================================================
  document.addEventListener('click', (event) => {
    const link = event.target.closest('[data-go]');
    if (!link) return;
    event.preventDefault();
    const view = link.dataset.go;
    if (view === 'list') { show('list'); return; }
    (view === 'grading' ? openGrading() : Promise.resolve(openCounter())).catch((err) => say(err.message, true));
  });

  async function loadOptions() {
    options = await api.get('/fees/options');
  }

  (async function start() {
    try {
      [, belts] = await Promise.all([loadOptions(), api.get('/belts')]);
      $('f-centre').innerHTML = '<option value="">All centres</option>' + optionTags(options.centres);
      await loadFees();
    } catch (err) {
      showError('#fees-table', err);
    }
  })();
})();
