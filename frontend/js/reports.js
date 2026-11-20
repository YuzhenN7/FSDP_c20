(() => {
  const $ = (s) => document.querySelector(s);
  let data = null;
  let tab = 'payments';

  // a column: text() is used for the CSV, html() (optional) for the screen
  const col = (label, text, html) => ({
    label,
    text,
    render: (r) => (html ? html(r) : esc(text(r))),
  });

  const TABS = {
    payments: {
      title: 'All payments',
      file: 'payment-history.csv',
      note: 'Failed attempts are listed but are not counted as money received.',
      rows: () => data.payments,
      columns: [
        col('Date', (r) => formatDate(r.at)),
        col('Student', (r) => r.student),
        col('Fee', (r) => r.fee),
        col('Method', (r) => r.method),
        col('Status', (r) => r.status, (r) => statusBadge(r.status)),
        col('Amount', (r) => formatMoney(r.amount)),
      ],
    },
    grades: {
      title: 'All student grades',
      file: 'student-grades.csv',
      note: '',
      rows: () => data.grades,
      columns: [
        col('Student', (r) => r.student),
        col('Current belt', (r) => r.current_belt || '-'),
        col('Graded for', (r) => r.graded_belt),
        col('Result', (r) => r.result, (r) => statusBadge(r.result)),
        col('Date', (r) => formatDate(r.graded_on)),
        col('Notes', (r) => r.notes || '-'),
      ],
    },
    revenue: {
      title: 'Revenue by month',
      file: 'revenue.csv',
      note: 'Revenue is money received, including GST. It is not profit: costs are not recorded in the system.',
      rows: () => data.revenue,
      columns: [
        col('Month', (r) => r.month),
        col('Payments', (r) => r.payments),
        col('Collected', (r) => formatMoney(r.collected)),
      ],
    },
    outstanding: {
      title: 'Outstanding and overdue fees',
      file: 'outstanding-fees.csv',
      note: 'Every unpaid fee right now (the date filter does not apply). Amounts include GST.',
      rows: () => data.outstanding,
      columns: [
        col('Student', (r) => r.student),
        col('Fee', (r) => r.fee),
        col('Due', (r) => formatDate(r.due_date)),
        col('Days overdue', (r) => (r.days_overdue > 0 ? r.days_overdue + ' days' : 'Not due yet'),
          (r) => (r.days_overdue > 0 ? `<span class="badge failed">${esc(r.days_overdue)} days</span>` : 'Not due yet')),
        col('To pay (incl. GST)', (r) => formatMoney(r.total)),
      ],
    },
  };

  function drawCards() {
    const s = data.summary;
    $('#cards').innerHTML = [
      ['Total collected', formatMoney(s.collected), 'incl. GST, in the date range'],
      ['Outstanding fees', formatMoney(s.outstanding_total), 'unpaid, incl. GST'],
      ['Overdue fees', s.overdue_count, 'past their due date'],
      ['Failed payments', s.failed_count, 'fee stays unpaid'],
    ].map(([k, v, sub]) => `<div class="card"><div class="k">${esc(k)}</div><div class="v">${esc(v)}</div><div class="s">${esc(sub)}</div></div>`).join('');
  }

  function drawTab() {
    const t = TABS[tab];
    $('#tab-title').textContent = t.title;
    $('#note').textContent = t.note;
    document.querySelectorAll('#tabs button').forEach((b) => b.classList.toggle('on', b.dataset.tab === tab));
    renderTable('#table', t.columns, t.rows());
  }

  async function load() {
    $('#table').textContent = 'Loading...';
    const q = new URLSearchParams();
    if ($('#from').value) q.set('from', $('#from').value);
    if ($('#to').value) q.set('to', $('#to').value);
    if ($('#centre').value) q.set('centre_id', $('#centre').value);
    try {
      data = await api.get('/reports/overview?' + q.toString());
      drawCards();
      drawTab();
    } catch (err) {
      showError('#table', err);
    }
  }

  function csvCell(v) {
    const s = String(v ?? '');
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }

  function exportCsv() {
    if (!data) return;
    const t = TABS[tab];
    const lines = [t.columns.map((c) => csvCell(c.label)).join(',')];
    t.rows().forEach((r) => lines.push(t.columns.map((c) => csvCell(c.text(r))).join(',')));
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = t.file;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  $('#tabs').addEventListener('click', (e) => {
    if (!e.target.dataset.tab || !data) return;
    tab = e.target.dataset.tab;
    drawTab();
  });
  $('#apply').addEventListener('click', load);
  $('#export').addEventListener('click', exportCsv);

  async function loadCentres(){
    try{
        const list = await api.get('/centres');
        $('#centre').innerHTML = '<option value="">All branches</option>'+ 
        list.map((c) => `<option value="${Number(c.id)}">${esc(c.name)}</option>`).join('');
    } catch (e) {
        console.warn('Failed to load centres:', e.message);
    }
  }

  (async function init() {
    await loadCentres();
    load();
  })();
})();