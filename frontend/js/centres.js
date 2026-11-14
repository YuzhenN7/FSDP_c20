// Admin: centres directory with search, filters and an edit mode. Used by frontend/admin/centres.html
// Needs api.js, ui.js and layout.js loaded first.
//
// Names and addresses come from GET /api/centres.
// Region and condition are NOT in the database yet, so they are kept on this page only.
// Once the backend sends "region" and "condition" for each centre, this page shows them automatically.

(function () {
    const REGIONS = ['Central', 'North', 'South', 'East', 'West'];
  const CONDITIONS = ['Open', 'Under renovation', 'Temporarily closed'];
  const NOT_SET = '<span class="muted">Not set</span>';
  const $ = (id) => document.getElementById(id);

  let centres = [];      // [{ id, name, address, region, condition }]
  let editing = false;

  // <option> tags for a dropdown. emptyLabel is the first choice (value "").
  function options(values, selected, emptyLabel) {
    return `<option value="">${esc(emptyLabel)}</option>` +
      values.map((v) => `<option${v === selected ? ' selected' : ''}>${esc(v)}</option>`).join('');
  }

  // One Region / Condition cell: plain text normally, a dropdown in edit mode
  function cell(centre, field, values) {
    if (!editing) return centre[field] ? esc(centre[field]) : NOT_SET;
    return `<select data-id="${esc(centre.id)}" data-field="${field}" aria-label="${field} for ${esc(centre.name)}">` +
      options(values, centre[field], 'Not set') + '</select>';
  }

  function render() {
    const text = $('search').value.trim().toLowerCase();
    const region = $('region').value;
    const condition = $('condition').value;

    const shown = centres.filter((c) =>
      `${c.name} ${c.address || ''}`.toLowerCase().includes(text) &&
      (!region || c.region === region) &&
      (!condition || c.condition === condition));

    if (centres.length > 0 && shown.length === 0) {
      $('list').innerHTML = '<div class="empty">No centres match your search.</div>';
      return;
    }
    renderTable('#list', [
      { label: 'Centre name', key: 'name' },
      { label: 'Address', render: (c) => (c.address ? esc(c.address) : NOT_SET) },
      { label: 'Region', render: (c) => cell(c, 'region', REGIONS) },
      { label: 'Condition', render: (c) => cell(c, 'condition', CONDITIONS) },
    ], shown);
  }

  // A dropdown in the table was changed (edit mode)
  $('list').addEventListener('change', (event) => {
    const select = event.target.closest('select[data-field]');
    if (!select) return;
    const centre = centres.find((c) => String(c.id) === select.dataset.id);
    centre[select.dataset.field] = select.value || null;
    // TODO (backend): save it, e.g.
    //   await api.put('/centres/' + centre.id, { region: centre.region, condition: centre.condition });
  });

  $('edit').addEventListener('click', () => {
    editing = !editing;
    $('edit').textContent = editing ? 'Done' : 'Edit';
    render();
  });

  $('search').addEventListener('input', render);
  $('region').addEventListener('change', render);
  $('condition').addEventListener('change', render);

  (async function load() {
    $('region').innerHTML = options(REGIONS, '', 'All regions');
    $('condition').innerHTML = options(CONDITIONS, '', 'All conditions');
    try {
      centres = await api.get('/centres');
      render();
    } catch (err) {
      showError('#list', err);
    }
  })();
})();