const API = '/api/belts';
const rows = document.getElementById('belt-rows');
const message = document.getElementById('message');

function showMessage(text) { message.textContent = text || ''; }

async function request(url, options) {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Something went wrong.');
  return data;
}

async function loadBelts() {
  try {
    const belts = await request(API);
    rows.replaceChildren(...belts.map(buildRow));
  } catch (err) { showMessage(err.message); }
}

function buildRow(belt) {
  const tr = document.createElement('tr');
  const order = document.createElement('td');
  order.textContent = belt.sort_order;
  const name = document.createElement('td');
  name.textContent = belt.name;

  const actions = document.createElement('td');
  const editBtn = document.createElement('button');
  editBtn.textContent = 'Edit';
  editBtn.onclick = () => editBelt(belt);
  const deleteBtn = document.createElement('button');
  deleteBtn.textContent = 'Delete';
  deleteBtn.onclick = () => deleteBelt(belt);
  actions.append(editBtn, ' ', deleteBtn);

  tr.append(order, name, actions);
  return tr;
}

async function editBelt(belt) {
  const name = prompt('Belt name:', belt.name);
  if (name === null) return;
  const order = prompt('Order number:', belt.sort_order);
  if (order === null) return;
  try {
    await request(`${API}/${belt.id}`, {
      method: 'PUT',
      body: JSON.stringify({ name, sort_order: order })
    });
    showMessage('Belt updated.');
    loadBelts();
  } catch (err) { showMessage(err.message); }
}

async function deleteBelt(belt) {
  if (!confirm(`Delete "${belt.name}"?`)) return;
  try {
    await request(`${API}/${belt.id}`, { method: 'DELETE' });
    showMessage('Belt deleted.');
    loadBelts();
  } catch (err) { showMessage(err.message); }
}

document.getElementById('belt-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = document.getElementById('belt-name').value;
  const order = document.getElementById('belt-order').value;
  try {
    await request(API, {
      method: 'POST',
      body: JSON.stringify({ name, sort_order: order === '' ? null : order })
    });
    e.target.reset();
    showMessage('Belt added.');
    loadBelts();
  } catch (err) { showMessage(err.message); }
});

loadBelts();