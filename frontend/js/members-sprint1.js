/* SCRUM-6: admin-only student records UI; all API operations validate server-side. */
(() => {
  const form = document.querySelector('#member-form');
  const message = document.querySelector('#form-message');
  const table = document.querySelector('#members-table');
  let all = [], editingId = null;
  const show = (text, error = false) => { message.hidden = false; message.textContent = text; message.classList.toggle('error', error); };
  const hide = () => { message.hidden = true; message.textContent = ''; };
  const val = (name) => form.elements.namedItem(name).value;
  async function init() {
    try {
      const opt = await api.get('/members/options');
      for (const [name, data, placeholder] of [
        ['centre_id', opt.centres, 'Select dojo'], ['belt_id', opt.belts, 'Select current belt']]) {
        form.elements.namedItem(name).innerHTML = `<option value="">${placeholder}</option>` +
          data.map((r) => `<option value="${Number(r.id)}">${esc(r.name)}</option>`).join('');
        if (name === 'centre_id') document.querySelector('#filter-dojo').innerHTML = '<option value="">All dojos</option>' +
          data.map((r) => `<option value="${Number(r.id)}">${esc(r.name)}</option>`).join('');
      }
      form.elements.namedItem('joined_on').value = new Date().toISOString().slice(0,10);
      await load();
    } catch (err) { show(err.message, true); table.textContent = err.message; }
  }
  function resetForm() {
    editingId = null; form.reset();
    form.elements.namedItem('joined_on').value = new Date().toISOString().slice(0,10);
    const pass = form.elements.namedItem('password'); pass.required = true; pass.disabled = false;
    document.querySelector('#password-row').hidden = false;
    document.querySelector('#form-heading').textContent = 'Add a student';
    document.querySelector('#save-student').textContent = 'Create student';
    document.querySelector('#cancel-edit').hidden = true;
  }
  async function load() {
    const params = new URLSearchParams({
      search: document.querySelector('#search').value.trim(),
      centre_id: document.querySelector('#filter-dojo').value,
      status: document.querySelector('#filter-status').value,
    });
    all = await api.get('/members?' + params.toString());
    if (!all.length) { table.innerHTML = '<p class="empty">No matching students.</p>'; return; }
    table.innerHTML = `<table><thead><tr><th>Name</th><th>Email</th><th>Principal dojo</th><th>Belt</th><th>Status</th><th>Joined</th><th>Actions</th></tr></thead><tbody>` +
      all.map((s) => `<tr><td>${esc(s.name)}</td><td>${esc(s.email)}</td><td>${esc(s.centre || 'Not assigned')}</td>
        <td>${esc(s.belt || 'Not assigned')}</td><td><span class="s1-pill ${esc(s.membership_status)}">${esc(s.membership_status)}</span></td>
        <td>${esc(formatDate(s.joined_on))}</td>
        <td><div class="s1-inline-buttons"><button class="btn small outline" type="button" data-edit="${Number(s.id)}">Edit</button>
        ${s.membership_status !== 'inactive' ? `<button class="btn small outline" type="button" data-deactivate="${Number(s.id)}">Deactivate</button>` : ''}</div></td></tr>`).join('') +
      '</tbody></table>';
  }
  function edit(id) {
    const s = all.find((record) => Number(record.id) === id);
    if (!s) return;
    editingId = id;
    for (const name of ['name','email','centre_id','belt_id','membership_status','joined_on']) {
      form.elements.namedItem(name).value = s[name] == null ? '' : String(s[name]).slice(0, name === 'joined_on' ? 10 : undefined);
    }
    form.elements.namedItem('password').required = false;
    form.elements.namedItem('password').disabled = true;
    document.querySelector('#password-row').hidden = true;
    document.querySelector('#form-heading').textContent = 'Edit student';
    document.querySelector('#save-student').textContent = 'Save changes';
    document.querySelector('#cancel-edit').hidden = false;
    hide(); form.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  table.addEventListener('click', async (event) => {
    const editButton = event.target.closest('[data-edit]');
    const deactivateButton = event.target.closest('[data-deactivate]');
    if (editButton) edit(Number(editButton.dataset.edit));
    if (deactivateButton) {
      const id = Number(deactivateButton.dataset.deactivate);
      const record = all.find((s) => Number(s.id) === id);
      if (!record || !confirm(`Deactivate ${record.name}'s membership? Their student login will stop working.`)) return;
      try { await api.request('PATCH', `/members/${id}/deactivate`, {}); show('Student membership deactivated.'); await load(); }
      catch (err) { show(err.message, true); }
    }
  });
  form.addEventListener('submit', async (event) => {
    event.preventDefault(); hide();
    const payload = {
      name: val('name').trim(), email: val('email').trim(), centre_id: Number(val('centre_id')),
      belt_id: Number(val('belt_id')), joined_on: val('joined_on'), membership_status: val('membership_status'),
    };
    if (!editingId) payload.password = val('password');
    try {
      await (editingId ? api.put(`/members/${editingId}`, payload) : api.post('/members', payload));
      const note = editingId ? 'Student record updated.' : 'Student created successfully.';
      resetForm(); show(note); await load();
    } catch (err) { show(err.message, true); }
  });
  document.querySelector('#cancel-edit').addEventListener('click', () => { resetForm(); hide(); });
  document.querySelector('#search-button').addEventListener('click', () => load().catch((e) => show(e.message, true)));
  document.querySelector('#search').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); load().catch((err) => show(err.message,true)); } });
  document.querySelector('#filter-dojo').addEventListener('change', () => load().catch((e) => show(e.message, true)));
  document.querySelector('#filter-status').addEventListener('change', () => load().catch((e) => show(e.message, true)));
  init();
})();
