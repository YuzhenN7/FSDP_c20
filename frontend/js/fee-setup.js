// Admin: set up fee types and packages. Used by frontend/admin/fee-setup.html
// Needs api.js, ui.js and layout.js loaded first (they are, in that order).
// Fee types are saved through /api/fee-types. Packages are still sample data (their routes come next).

(function () {
  const GST_RATE = 9;                      
  const API = '/fee-types';                
  const PKG_API = '/fee-packages';     
  const SEPARATE = ['grading', 'late_fee'];   // never allowed inside a package
  const r2 = (n) => Math.round(n * 100) / 100;
  const $ = (id) => document.getElementById(id);

  let fees = [];
  let packages = [];
  let editingId = null;       // fee being edited (null = adding)
  let editingPkgId = null;    // package being edited (null = creating)

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
  const pkgfromApi = (r) => ({
    id: r.id, name: r.name, group: r.student_group, discount: Number(r.discount_percent),
    validity: r.validity || '', description: r.description || '',
    status: r.is_active ? 'active' : 'inactive',
    feeIds: r.items.map((i) => i.id), feeNames: r.items.map((i) => i.name), 
    price: Number(r.price),
  });

  async function loadAll() {
  $('pageError').innerHTML = '';
  try {
    fees = (await api.get(API)).map(fromApi);
  } catch (err) {
    showError('#pageError', new Error('Could not load fees: ' + err.message));
  }
  try {
    packages = (await api.get(PKG_API)).map(pkgfromApi);
  } catch (err) {
    showError('#pageError', new Error('Could not load packages: ' + err.message));
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
      { label: 'Fees included', render: (p) => esc(p.feeNames.join(', ')) },
      { label: 'Price (incl. GST*)', render: (p) => esc(formatMoney(p.price)) },
      {
        label: 'Status',
        render: (p) => `<span class="badge ${p.status === 'active' ? 'active' : 'off'}">${p.status === 'active' ? 'Active' : 'Inactive'}</span>`,
      },
      {
        label: '',
        render: (p) => `
          <button class="linkbtn plain" data-edit-pkg="${p.id}" type="button">Edit</button>
          <button class="linkbtn plain danger" data-toggle-pkg="${p.id}" type="button">${p.status === 'active' ? 'Deactivate' : 'Activate'}</button>`,
      },
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
      await loadAll();
    } catch (err) {
      $('feeError').textContent = err.message;   // for example "A fee with this name already exists."
    }
  });

  // ---------- Create Package pop-up ----------
  function openPackage(pkg) {
    editingPkgId = pkg ? pkg.id : null;
    $('pkgTitle').textContent = pkg ? 'Edit Package' : 'Create Package';
    $('pkgSubmit').textContent = pkg ? 'Save Package' : 'Create Package';
    $('p-name').value = pkg ? pkg.name : '';
    $('p-desc').value = pkg ? pkg.description : '';
    $('p-group').value = pkg ? pkg.group : 'Adult';
    $('p-discount').value = pkg ? pkg.discount : 0;
    $('p-valid').value = pkg && pkg.validity ? pkg.validity : '6 months';
    setToggle('p-status', pkg ? pkg.status : 'active');
    $('pkgError').textContent = '';
    $('p-fees').innerHTML = fees.map((f) => {
      const checked = pkg ? pkg.feeIds.includes(f.id) : false;    
      const ok = f.inPackages && f.status != null && (f.status === 'active' || checked);
      const why = !f.inPackages ? 'Charged separately' : f.status !== 'active' ? 'Inactive' : 'No fixed price';
      return `<label class="fee-pick ${ok ? '' : 'off'}">
        <input type="checkbox" value="${f.id}" ${ok ? '' : 'disabled'} ${checked ? 'checked' : ''}>
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

  $('pkgForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const t = pkgTotals();
    if (t.list.length === 0) { $('pkgError').textContent = 'Select at least one fee.'; return; }
    const body = {
      name: $('p-name').value.trim(), student_group: $('p-group').value,
      description: $('p-desc').value.trim(), discount_percent: Number($('p-discount').value),
      validity: $('p-valid').value, is_active: getToggle('p-status') === 'active',
      fee_type_ids: t.list.map((f) => f.id),
    };
    try {
      if (editingPkgId) await api.put(`${PKG_API}/${editingPkgId}`, body);
      else await api.post(PKG_API, body);
      closeModals();
      await loadAll();
    } catch (err) {
      $('pkgError').textContent = err.message;   // Example: "A package with this name already exists."
    }
  });

  // ---------- buttons ----------
  $('addFee').addEventListener('click', () => openFee(null));
  $('addPackage').addEventListener('click', () => openPackage(null));

  document.addEventListener('click', async (e) => {
    if (e.target.matches('[data-close]') || e.target.classList.contains('backdrop')) closeModals();

    const toggleBtn = e.target.closest('.toggle button');
    if (toggleBtn) setToggle(toggleBtn.parentElement.id, toggleBtn.dataset.val);

    const edit = e.target.closest('[data-edit]');
    if (edit) openFee(fees.find((f) => f.id === Number(edit.dataset.edit)));

    const editPkg = e.target.closest('[data-edit-pkg]')
    if (editPkg) openPackage(packages.find((p) => p.id === Number(editPkg.dataset.editPkg)));

    const tog = e.target.closest('[data-toggle]');
    if (tog) {
      const f = fees.find((x) => x.id === Number(tog.dataset.toggle));
      try {
        await api.request('PATCH', `${API}/${f.id}/active`, { is_active: f.status !== 'active' });
        await loadAll();
      } catch (err) {
        showError('#pageError', err);
      }
    }
    const togPkg = e.target.closest('[data-toggle-pkg]');
    if (togPkg) {
      const p = packages.find((x) => x.id === Number(togPkg.dataset.togglePkg));
      try {
        await api.request('PATCH', `${PKG_API}/${p.id}/active`, { is_active: p.status !== 'active' });
        await loadAll();
      } catch (err) { showError('#pageError', err); }
    }
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModals(); });

  render();
  loadAll();
})();