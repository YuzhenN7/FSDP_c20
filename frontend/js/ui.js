// Small helpers for building pages. Loaded on every page.

// Makes text safe to put inside HTML (always use this for data that came from the database)
function esc(text) {
  return String(text ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

function formatMoney(amount) {
  return '$' + Number(amount).toFixed(2);
}

function formatDate(value) {
  if (!value) return '-';
  const d = new Date(value);
  if (isNaN(d)) return String(value);
  return d.toLocaleDateString('en-SG', { day: 'numeric', month: 'short', year: 'numeric' });
}

// "18:30:00" -> "18:30"
function formatTime(value) {
  return value ? String(value).slice(0, 5) : '-';
}

function statusBadge(status) {
  return `<span class="badge ${esc(status)}">${esc(status)}</span>`;
}

// Draws a table inside the element matching `target` (e.g. '#list').
//   columns: [{ label: 'Name', key: 'name' }, { label: 'Amount', render: (row) => formatMoney(row.amount) }]
//   rows:    array of objects from the API
// Values from `key` are escaped automatically. A `render` function must escape its own data (use esc()).
function renderTable(target, columns, rows) {
  const el = document.querySelector(target);
  if (!rows || rows.length === 0) {
    el.innerHTML = '<div class="empty">Nothing here yet.</div>';
    return;
  }
  const head = columns.map((c) => `<th>${esc(c.label)}</th>`).join('');
  const body = rows
    .map((row) => {
      const cells = columns
        .map((c) => `<td>${c.render ? c.render(row) : esc(row[c.key] ?? '-')}</td>`)
        .join('');
      return `<tr>${cells}</tr>`;
    })
    .join('');
  el.innerHTML = `<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
}

// Shows an error message inside the element matching `target`
function showError(target, err) {
  const el = document.querySelector(target);
  if (el) el.innerHTML = `<div class="error">${esc(err.message || err)}</div>`;
}
