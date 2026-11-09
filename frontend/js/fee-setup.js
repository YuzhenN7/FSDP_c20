// Admin: set up fee types and packages. Used by frontend/admin/fee-setup.html
// Needs api.js, ui.js and layout.js loaded first (they are, in that order).
// Fee types are saved through /api/fee-types. Packages are still sample data (their routes come next).

(function () {
  const GST_RATE = 9;                      // example rate only, not a verified Shinju-Kai rate
  const API = '/fee-types';                // api.js adds the /api in front
  const SEPARATE = ['grading', 'late_fee'];   // never allowed inside a package
  const r2 = (n) => Math.round(n * 100) / 100;
  const $ = (id) => document.getElementById(id);

  let fees = [];
  let editingId = null;
  let packages = [
    { name: 'Starter Pack',    group: 'Adult', price: '$346.62' },
    { name: 'New Member Pack', group: 'Adult', price: '$408.24' },
  ];

  // database row -> the shape this page uses
  const fromApi = (r) => ({
    id: r.id, name: r.name, category: r.category, group: r.student_group,
    base: r.base_amount === null ? null : Number(r.base_amount),
    discount: Number(r.discount_percent), inPackages: r.can_be_in_package,
    status: r.is_active ? 'active' : 'inactive', description: r.description || '',
  });
  // this page's shape -> what the backend expects
  const toApi = (d) => ({
    name: d.name, category: d.category, student_group: d.group, base_amount: d.base,
    discount_percent: d.discount, can_be_in_package: d.inPackages,
    description: d.description, is_active: d.status === 'active',
  });

  async function loadFees() {
    try {
      fees = (await api.get(API)).map(fromApi);
      $('pageError').innerHTML = '';
    } catch (err) {
      showError('#pageError', new Error('Could not load fees: ' + err.message));
    }
    render();
  }

  // ---------- pop-up and toggle-button helpers ----------
  function showModal(id) { $(id).hidden = false; document.body.classList.add('modal-open'); }
  function closeModals() {
    document.querySelectorAll('.backdrop').forEach((b) => { b.hidden = true; });
    document.body.classList.remove('modal-open');
  }
  const getToggle = (id) => $(id).querySelector('.on').dataset.val;
  const setToggle = (id, val) =>
    $(id).querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.val === String(val)));

  // ---------- the two tables ----------
  function render() {
    renderTable('#feeList', [
      { label: 'Fee type', key: 'name' },
      { label: 'Amount', render: (f) => (f.base == null ? 'By belt grade' : esc(formatMoney(f.base))) },
      { label: 'In packages?', render: (f) => (f.inPackages ? 'Yes' : '<span class="badge info">Charged separately</span>') },
      {
        label: 'Status',
        render: (f) => `<span class="badge ${f.status === 'active' ? 'active' : 'off'}">${f.status === 'active' ? 'Active' : 'Inactive'}</span>`,
      },
      {
        label: '',
        render: (f) => `
          <button class="linkbtn plain" data-edit="${f.id}" type="button">Edit</button>
          <button class="linkbtn plain danger" data-toggle="${f.id}" type="button">${f.status === 'active' ? 'Deactivate' : 'Activate'}</button>`,
      },
    ], fees);

    renderTable('#pkgList', [
      { label: 'Package', key: 'name' },
      { label: 'Target group', key: 'group' },
      { label: 'Price', key: 'price' },
      { label: '', render: () => '<button class="linkbtn plain" type="button">Edit</button>' },
    ], packages);
  }

  // ---------- Add / Edit Fee pop-up ----------
  function openFee(fee) {
    editingId = fee ? fee.id : null;
    $('feeTitle').textContent = fee ? 'Edit Fee' : 'Add New Fee';
    $('f-name').value = fee ? fee.name : '';
    $('f-category').value = fee ? fee.category : 'registration';
    $('f-group').value = fee ? fee.group : 'Adult';
    $('f-amount').value = fee && fee.base != null ? fee.base : '';
    $('f-discount').value = fee ? fee.discount : 0;
    setToggle('f-pkg', !fee || fee.inPackages ? '1' : '0');
    $('f-desc').value = fee ? fee.description : '';
    setToggle('f-status', fee ? fee.status : 'active');
    $('feeError').textContent = '';
    feePreview();
    showModal('feeModal');
  }

  function feePreview() {
    const base = Number($('f-amount').value);
    if (!base) {
      ['base', 'disc', 'gst', 'final'].forEach((k) => { $('fv-' + k).textContent = '-'; });
      return;
    }
    const disc = r2(base * Number($('f-discount').value) / 100);
    const gst = r2((base - disc) * GST_RATE / 100);
    $('fv-base').textContent = formatMoney(base);
    $('fv-disc').textContent = '- ' + formatMoney(disc);
    $('fv-gst').textContent = formatMoney(gst);
    $('fv-final').textContent = formatMoney(r2(base - disc + gst));
  }

  $('f-category').addEventListener('change', () => {
    if (SEPARATE.includes($('f-category').value)) setToggle('f-pkg', '0');
  });
  $('f-amount').addEventListener('input', feePreview);
  $('f-discount').addEventListener('change', feePreview);

  $('feeForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const category = $('f-category').value;
    const base = $('f-amount').value === '' ? null : Number($('f-amount').value);
    if (base === null && category !== 'grading') { $('feeError').textContent = 'Enter the fee amount.'; return; }
    if (base !== null && base <= 0) { $('feeError').textContent = 'Fee amount must be more than 0.'; return; }
    const data = {
      name: $('f-name').value.trim(), category, group: $('f-group').value, base,
      discount: Number($('f-discount').value),
      inPackages: SEPARATE.includes(category) ? false : getToggle('f-pkg') === '1',
      description: $('f-desc').value.trim(), status: getToggle('f-status'),
    };
    try {
      if (editingId) await api.put(`${API}/${editingId}`, toApi(data));
      else await api.post(API, toApi(data));
      closeModals();
      await loadFees();
    } catch (err) {
      $('feeError').textContent = err.message;   // for example "A fee with this name already exists."
    }
  });

  // ---------- Create Package pop-up (sample data for now) ----------
  function openPackage() {
    ['p-name', 'p-desc'].forEach((id) => { $(id).value = ''; });
    $('p-group').value = 'Adult';
    $('p-discount').value = 0;
    $('p-valid').value = '6 months';
    setToggle('p-status', 'active');
    $('pkgError').textContent = '';
    $('p-fees').innerHTML = fees.map((f) => {
      const ok = f.inPackages && f.status === 'active' && f.base != null;
      const why = !f.inPackages ? 'Charged separately' : f.status !== 'active' ? 'Inactive' : 'No fixed price';
      return `<label class="fee-pick ${ok ? '' : 'off'}">
        <input type="checkbox" value="${f.id}" ${ok ? '' : 'disabled'}>
        <span>${esc(f.name)}</span>
        <span>${ok ? esc(formatMoney(f.base)) : why}</span></label>`;
    }).join('');
    pkgPreview();
    showModal('pkgModal');
  }

  const picked = () =>
    [...document.querySelectorAll('#p-fees input:checked')].map((i) => fees.find((f) => f.id === Number(i.value)));

  function pkgTotals() {
    const list = picked();
    const sub = list.reduce((s, f) => s + f.base, 0);
    const disc = r2(sub * Number($('p-discount').value) / 100);
    const gst = r2((sub - disc) * GST_RATE / 100);
    return { list, sub: r2(sub), disc, gst, final: r2(sub - disc + gst) };
  }

  function pkgPreview() {
    const t = pkgTotals();
    $('pp-lines').innerHTML = t.list
      .map((f) => `<div class="kv"><span>${esc(f.name)}</span><span>${esc(formatMoney(f.base))}</span></div>`)
      .join('');
    $('pv-sub').textContent = formatMoney(t.sub);
    $('pv-disc').textContent = '- ' + formatMoney(t.disc);
    $('pv-gst').textContent = formatMoney(t.gst);
    $('pv-final').textContent = formatMoney(t.final);
  }

  $('p-fees').addEventListener('change', pkgPreview);
  $('p-discount').addEventListener('change', pkgPreview);

  $('pkgForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const t = pkgTotals();
    if (t.list.length === 0) { $('pkgError').textContent = 'Select at least one fee.'; return; }
    packages.push({ name: $('p-name').value.trim(), group: $('p-group').value, price: formatMoney(t.final) });
    closeModals();
    render();
  });

  // ---------- buttons ----------
  $('addFee').addEventListener('click', () => openFee(null));
  $('addPackage').addEventListener('click', openPackage);

  document.addEventListener('click', async (e) => {
    if (e.target.matches('[data-close]') || e.target.classList.contains('backdrop')) closeModals();

    const toggleBtn = e.target.closest('.toggle button');
    if (toggleBtn) setToggle(toggleBtn.parentElement.id, toggleBtn.dataset.val);

    const edit = e.target.closest('[data-edit]');
    if (edit) openFee(fees.find((f) => f.id === Number(edit.dataset.edit)));

    const tog = e.target.closest('[data-toggle]');
    if (tog) {
      const f = fees.find((x) => x.id === Number(tog.dataset.toggle));
      try {
        await api.request('PATCH', `${API}/${f.id}/active`, { is_active: f.status !== 'active' });
        await loadFees();
      } catch (err) {
        showError('#pageError', err);
      }
    }
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModals(); });

  render();
  loadFees();
})();