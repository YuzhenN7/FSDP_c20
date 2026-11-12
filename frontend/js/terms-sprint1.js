/* SCRUM-17: create terms, assign weekly classes and exclude holidays from calendar. */
(() => {
  const msg = document.querySelector('#term-message');
  const termSelect = document.querySelector('#selected-term');
  const classSelect = document.querySelector('#available-class');
  const weeklyList = document.querySelector('#weekly-classes');
  const calendar = document.querySelector('#term-calendar');
  const holidaysList = document.querySelector('#holidays-list');
  const show = (text, error = false) => { msg.hidden = false; msg.textContent = text; msg.classList.toggle('error', error); };
  const val = (form, name) => form.elements.namedItem(name).value;
  async function loadTerms(prefer = '') {
    const terms = await api.get('/terms');
    termSelect.innerHTML = '<option value="">Choose a term</option>' + terms.map((t) =>
      `<option value="${Number(t.id)}">${esc(t.name)} (${esc(formatDate(t.start_date))} – ${esc(formatDate(t.end_date))})</option>`).join('');
    termSelect.value = prefer || (terms.length ? String(terms[0].id) : '');
    await loadSelected();
  }
  async function loadHolidays() {
    const holidays = await api.get('/terms/holidays');
    holidaysList.innerHTML = holidays.length ? holidays.map((h) =>
      `<li><span><strong>${esc(h.name)}</strong><div class="meta">${esc(formatDate(h.holiday_date))}</div></span>
        <button class="btn small outline" type="button" data-date="${esc(h.holiday_date)}">Remove</button></li>`).join('')
      : '<li class="muted">No holiday dates entered yet.</li>';
  }
  async function loadAvailable() {
    const classes = await api.get('/terms/available-classes');
    classSelect.innerHTML = '<option value="">Choose a class</option>' + classes.map((c) =>
      `<option value="${Number(c.id)}">${esc(c.centre)} · ${esc(c.name)} · ${esc(c.day_of_week || 'No weekday')}</option>`).join('');
  }
  async function loadSelected() {
    const id = termSelect.value;
    if (!id) { weeklyList.innerHTML = '<li class="muted">Create a term to begin.</li>'; calendar.textContent = 'No term selected.'; return; }
    const [term, dates] = await Promise.all([api.get(`/terms/${id}`), api.get(`/terms/${id}/calendar`)]);
    weeklyList.innerHTML = term.classes.length ? term.classes.map((c) =>
      `<li><span><strong>${esc(c.name)}</strong><div class="meta">${esc(c.centre)} · ${esc(c.day_of_week || '-')} · ${esc(formatTime(c.start_time))}–${esc(formatTime(c.end_time))}</div></span>
      <button class="btn small outline" type="button" data-class-id="${Number(c.class_id)}">Remove</button></li>`).join('')
      : '<li class="muted">No recurring classes assigned yet.</li>';
    if (!dates.length) { calendar.innerHTML = '<p class="empty">No sessions to display. Add weekly classes or check term dates.</p>'; return; }
    renderTable('#term-calendar', [
      { label:'Date',render:(c)=>esc(formatDate(c.class_date)) },
      { label:'Class',key:'name' }, { label:'Dojo',key:'centre' },
      { label:'Time',render:(c)=>esc(formatTime(c.start_time))+' – '+esc(formatTime(c.end_time)) },
      { label:'Venue',key:'venue' }, { label:'Instructor',key:'instructor' },
    ], dates);
  }
  document.querySelector('#term-form').addEventListener('submit', async (e) => {
    e.preventDefault();const f=e.currentTarget;
    try {const created = await api.post('/terms', {name:val(f,'name'),start_date:val(f,'start_date'),end_date:val(f,'end_date')});
      f.reset(); show('Term created. Now assign its weekly classes.'); await loadTerms(String(created.id));}
    catch(err){show(err.message,true);}
  });
  document.querySelector('#holiday-form').addEventListener('submit', async(e)=>{
    e.preventDefault();const f=e.currentTarget;
    try{await api.post('/terms/holidays',{holiday_date:val(f,'holiday_date'),name:val(f,'name')});
      f.reset();show('Holiday saved; sessions on this date are excluded.');await loadHolidays();await loadSelected();}
    catch(err){show(err.message,true);}
  });
  holidaysList.addEventListener('click',async(e)=>{
    const btn=e.target.closest('[data-date]');if(!btn)return;
    try{await api.del('/terms/holidays/'+encodeURIComponent(btn.dataset.date));show('Holiday removed.');await loadHolidays();await loadSelected();}
    catch(err){show(err.message,true);}
  });
  document.querySelector('#add-class').addEventListener('click',async()=>{
    if(!termSelect.value||!classSelect.value){show('Choose a term and a class first.',true);return;}
    try{await api.post(`/terms/${termSelect.value}/classes`,{class_id:Number(classSelect.value)});
      show('Weekly class assigned.');await loadSelected();}
    catch(err){show(err.message,true);}
  });
  weeklyList.addEventListener('click',async(e)=>{
    const btn=e.target.closest('[data-class-id]');if(!btn||!termSelect.value)return;
    try{await api.del(`/terms/${termSelect.value}/classes/${btn.dataset.classId}`);show('Class removed from term.');await loadSelected();}
    catch(err){show(err.message,true);}
  });
  termSelect.addEventListener('change',()=>loadSelected().catch((err)=>show(err.message,true)));
  Promise.all([loadAvailable(),loadHolidays(),loadTerms()]).catch((err)=>show(err.message,true));
})();
