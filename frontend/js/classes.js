// Admin: class timetable, assigned schedules, instructor availability and training venues.
// Used by frontend/admin/classes.html. Needs api.js, ui.js and layout.js loaded first.
//
// READS come from the API:  /centres, /classes, /classes/venues, /classes/instructors
// SAVED to the database:    assigning an instructor and venue to an existing class (SCRUM-18)
//                           PUT /classes/:id/assign  - the server refuses a double-booking and names the clash
// Still kept on this page only (the backend has no routes for them yet): new classes, venues, availability.
// Each of those is marked with "TODO (backend)".

(function () {
  const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const CATEGORIES = ['Adult', 'Children', 'Mixed', 'Advanced', 'Private'];
  const TABS = [
    { view: 'timetable', label: 'Timetable' },
    { view: 'assigned', label: 'Assigned schedules' },
    { view: 'availability', label: 'Instructor availability' },
    { view: 'venues', label: 'Training venues' },
  ];
  const $ = (id) => document.getElementById(id);

  // ---------- Data from the API ----------
  let centres = [];       // [{ id, name, address }]
  let classes = [];       // [{ id, name, centre_id, centre, venue_id, venue, instructor_id, instructor, day_of_week, start_time, end_time }]  + category (page only)
  let venues = [];        // [{ id, name, centre_id, centre }]
  let instructors = [];   // [{ id, name, email, centre_id, centre }]  + availability (page only)

  // ---------- What the page is showing ----------
  let centre = null;           // the centre chosen in the dropdown
  let tab = 'timetable';       // the highlighted tab
  let view = 'timetable';      // a tab, or one of the forms: 'create' / 'assign' / 'resource'
  let draft = null;            // the class being created or assigned
  let draftIndex = -1;         // its position in `classes` (-1 = a new class)
  let chosenInstructor = '';   // instructor picked on the "Assigned schedules" tab
  let resource = null;         // { kind: 'venue' | 'availability', item }  for the edit form

  // ---------- Helpers ----------
  const classesHere = () => classes.filter((c) => c.centre === centre.name);
  const venuesHere = () => venues.filter((v) => v.centre_id === centre.id);
  // Instructors based at this centre, plus anyone already teaching a class here
  const instructorsHere = () => instructors.filter((i) =>
    i.centre_id === centre.id || classesHere().some((c) => c.instructor === i.name));

  const shortDay = (day) => (day || '?').slice(0, 3);
  const catClass = (category) => (category ? 'cat-' + esc(category.toLowerCase()) : '');
  const chip = (category) => `<span class="chip ${catClass(category)}">${esc(category)}</span>`;
  // SCRUM-18: what a class still needs before it is complete, e.g. ['instructor', 'venue']. Empty = complete.
  const missing = (c) => [c.instructor ? null : 'instructor', c.venue ? null : 'venue'].filter(Boolean);
  const head = (title, action = '') => `<div class="panel-head"><h2>${esc(title)}</h2>${action}</div>`;

  // <option> tags for a dropdown. If emptyLabel is given, it becomes the first choice (value "").
  function options(values, selected, emptyLabel) {
    const first = emptyLabel === undefined ? '' : `<option value="">${esc(emptyLabel)}</option>`;
    return first + values.map((v) => `<option${v === selected ? ' selected' : ''}>${esc(v)}</option>`).join('');
  }

  // <option> tags whose value is the item's id (so the form sends ids to the server)
  function idOptions(items, selectedId, label = (item) => item.name) {
    return items.map((item) =>
      `<option value="${esc(item.id ?? '')}"${item.id === selectedId ? ' selected' : ''}>${esc(label(item))}</option>`).join('');
  }

  // ---------- Tab 1: weekly timetable ----------
  function timetableView() {
    // SCRUM-18: how many classes still have no instructor or no venue
    const incompleteHere = classesHere().filter((c) => missing(c).length > 0).length;
    const incompleteAll = classes.filter((c) => missing(c).length > 0).length;
    const warning = incompleteAll === 0 ? '' : `
      <p class="incomplete-note">
        <span class="badge incomplete">Incomplete</span>
        ${incompleteHere} at this centre, ${incompleteAll} across all centres still need an instructor or a venue.
      </p>`;

    const columns = DAYS.map((day) => {
      const events = classesHere()
        .filter((c) => c.day_of_week === day)
        .sort((a, b) => String(a.start_time).localeCompare(String(b.start_time)))
        .map((c) => `
          <button class="event ${catClass(c.category)}" type="button" data-action="assign" data-index="${classes.indexOf(c)}">
            ${esc(c.category || '')}
            <b>${esc(formatTime(c.start_time))} · ${esc(c.name)}</b>
            ${esc(c.venue || 'No venue yet')}<br>${esc(c.instructor || 'No instructor yet')}
            ${missing(c).length ? `<span class="badge incomplete">Incomplete: no ${esc(missing(c).join(' or '))}</span>` : ''}
          </button>`)
        .join('');
      return `<div class="day"><strong>${shortDay(day)}</strong>${events}</div>`;
    }).join('');

    return head('Weekly timetable', '<button class="btn" type="button" data-action="create">+ Create term schedule</button>') + `
      <p class="muted">Recurring weekly classes. Click a class to assign its instructor and venue.</p>
      ${warning}
      <p class="legend">${CATEGORIES.map(chip).join('')}</p>
      <div class="scroll-x"><div class="timetable">${columns}</div></div>`;
  }

  // ---------- Tab 2: classes assigned to one instructor ----------
  function assignedView() {
    const names = instructorsHere().map((i) => i.name);
    if (names.length === 0) {
      return head('Assigned class schedules') + '<p class="muted">No instructors at this centre yet.</p>';
    }
    if (!names.includes(chosenInstructor)) chosenInstructor = names[0];

    // SCRUM-18: every class this instructor teaches, at ANY centre (a clash can be between two centres)
    const rows = classes
      .filter((c) => c.instructor === chosenInstructor)
      .sort((a, b) => DAYS.indexOf(a.day_of_week) - DAYS.indexOf(b.day_of_week) ||
        String(a.start_time).localeCompare(String(b.start_time)))
      .map((c) => `
        <div class="list-row">
          <strong>${esc(c.name)}</strong>
          <span>${esc(shortDay(c.day_of_week))} · ${esc(formatTime(c.start_time))} - ${esc(formatTime(c.end_time))}</span>
          <span>${esc(c.centre)}</span>
          <span>${esc(c.venue || 'No venue yet')}</span>
        </div>`)
      .join('');

    return head('Assigned class schedules') + `
      <div class="form-narrow">
        <label for="pick-instructor">Instructor</label>
        <select id="pick-instructor">${options(names, chosenInstructor)}</select>
      </div>
      <p class="muted">This instructor's weekly schedule across all centres.</p>
      ${rows || '<p class="muted">No classes assigned to this instructor yet.</p>'}`;
  }

  // ---------- Tab 3: instructor availability ----------
  function availabilityView() {
    const rows = instructorsHere().map((i) => `
      <div class="list-row">
        <strong>${esc(i.name)}</strong>
        <span>${i.availability ? esc(i.availability) : '<span class="muted">Not set</span>'}</span>
        <button class="btn outline small" type="button" data-action="edit-availability" data-index="${instructors.indexOf(i)}">Edit</button>
      </div>`).join('');
    return head('Instructor availability') + (rows || '<p class="muted">No instructors at this centre yet.</p>');
  }

  // ---------- Tab 4: training venues ----------
  function venuesView() {
    const rows = venuesHere().map((v) => `
      <div class="list-row">
        <strong>${esc(v.name)}</strong>
        <span>Training space</span>
        <button class="btn outline small" type="button" data-action="edit-venue" data-index="${venues.indexOf(v)}">Edit</button>
      </div>`).join('');
    return head('Training venues', '<button class="btn outline" type="button" data-action="add-venue">+ Add venue</button>') +
      (rows || '<p class="muted">No venues at this centre yet.</p>');
  }

  // ---------- Form: create a class (step 1 of 2) ----------
  function createView() {
    return head('Create term schedule') + `
      <form class="form-narrow" id="create-form">
        <label for="c-category">Class category</label>
        <select id="c-category" required>${options(CATEGORIES, '', 'Choose category')}</select>

        <label for="c-name">Class name</label>
        <input id="c-name" required>

        <label for="c-day">Day</label>
        <select id="c-day">${options(DAYS, 'Monday')}</select>

        <label for="c-start">Start time</label>
        <input id="c-start" type="time" required>

        <label for="c-end">End time</label>
        <input id="c-end" type="time" required>

        <p class="error" id="form-error"></p>
        <div class="form-actions">
          <button class="btn" type="submit">Next · Assign instructor and venue →</button>
          <button class="btn outline" type="button" data-action="cancel">Cancel</button>
        </div>
      </form>`;
  }

  // ---------- Form: assign instructor and venue (step 2, or after clicking a class) ----------
  function assignView() {
    // Instructors based at this centre first, then everyone else (an instructor can teach at another centre)
    const local = instructors.filter((i) => i.centre_id === centre.id);
    const others = instructors.filter((i) => i.centre_id !== centre.id);
    const instructorOptions = '<option value="">Not assigned</option>' +
      (local.length ? `<optgroup label="Based at ${esc(centre.name)}">${idOptions(local, draft.instructor_id)}</optgroup>` : '') +
      (others.length ? `<optgroup label="Other centres">${idOptions(others, draft.instructor_id, (i) => `${i.name} (${i.centre || 'no centre'})`)}</optgroup>` : '');
    const venueOptions = '<option value="">Not assigned</option>' + idOptions(venuesHere(), draft.venue_id);

    return head('Assign instructor and venue') + `
      <p>
        ${esc(draft.name)} · ${draft.category ? chip(draft.category) + ' · ' : ''}
        ${esc(shortDay(draft.day_of_week))} · ${esc(formatTime(draft.start_time))} - ${esc(formatTime(draft.end_time))}
      </p>
      <form class="form-narrow" id="assign-form">
        <label for="a-instructor">Instructor</label>
        <select id="a-instructor">${instructorOptions}</select>

        <label for="a-venue">Training venue</label>
        <select id="a-venue">${venueOptions}</select>
        ${venuesHere().length ? '' : '<p class="muted">This centre has no venues yet. Add one on the Training venues tab.</p>'}

        <p class="error" id="form-error"></p>
        <div class="form-actions">
          <button class="btn" type="submit">Save to timetable</button>
          <button class="btn outline" type="button" data-action="cancel">Cancel</button>
        </div>
      </form>`;
  }

  // ---------- Form: add / rename a venue, or edit an instructor's availability ----------
  function resourceView() {
    const isVenue = resource.kind === 'venue';
    const title = isVenue
      ? (resource.item ? 'Edit training venue' : 'Add training venue')
      : 'Availability · ' + resource.item.name;
    const current = isVenue ? (resource.item ? resource.item.name : '') : (resource.item.availability || '');

    return head(title) + `
      <form class="form-narrow" id="resource-form">
        <label for="r-value">${isVenue ? 'Venue / training space' : 'Available days and times'}</label>
        <input id="r-value" required value="${esc(current)}" placeholder="${isVenue ? 'e.g. Main hall' : 'e.g. Mon 18:00-20:00, Wed 17:00-20:00'}">

        <p class="error" id="form-error"></p>
        <div class="form-actions">
          <button class="btn" type="submit">Save changes</button>
          <button class="btn outline" type="button" data-action="cancel">Cancel</button>
        </div>
      </form>`;
  }

  // ---------- Draw the page ----------
  function render() {
    if (!centre) return;
    $('tabs').innerHTML = TABS.map((t) =>
      `<button type="button" data-view="${t.view}" class="${t.view === tab ? 'active' : ''}">${t.label}</button>`).join('');

    const views = {
      timetable: timetableView, assigned: assignedView, availability: availabilityView, venues: venuesView,
      create: createView, assign: assignView, resource: resourceView,
    };
    $('panel').innerHTML = views[view]();
  }

  function showTab(name) {
    tab = name;
    view = name;
    render();
  }

  // ---------- Clicks ----------
  $('tabs').addEventListener('click', (event) => {
    const button = event.target.closest('button[data-view]');
    if (button) showTab(button.dataset.view);
  });

  $('panel').addEventListener('click', (event) => {
    const button = event.target.closest('[data-action]');
    if (!button) return;
    const index = Number(button.dataset.index);

    switch (button.dataset.action) {
      case 'create':
        view = 'create';
        break;
      case 'assign':
        draftIndex = index;
        draft = { ...classes[index] };
        view = 'assign';
        break;
      case 'add-venue':
        resource = { kind: 'venue', item: null };
        view = 'resource';
        break;
      case 'edit-venue':
        resource = { kind: 'venue', item: venues[index] };
        view = 'resource';
        break;
      case 'edit-availability':
        resource = { kind: 'availability', item: instructors[index] };
        view = 'resource';
        break;
      case 'cancel':
        view = tab;
        break;
    }
    render();
  });

  $('panel').addEventListener('change', (event) => {
    if (event.target.id === 'pick-instructor') {
      chosenInstructor = event.target.value;
      render();
    }
  });

  // ---------- Form submits ----------
  $('panel').addEventListener('submit', async (event) => {
    event.preventDefault();
    const formId = event.target.id;

    if (formId === 'create-form') {
      const start = $('c-start').value;
      const end = $('c-end').value;
      if (end <= start) {
        $('form-error').textContent = 'End time must be after the start time.';
        return;
      }
      draftIndex = -1;
      draft = {
        id: null, name: $('c-name').value.trim(), centre_id: centre.id, centre: centre.name, category: $('c-category').value,
        day_of_week: $('c-day').value, start_time: start, end_time: end,
        venue_id: null, venue: null, instructor_id: null, instructor: null,
      };
      view = 'assign';
    }

    if (formId === 'assign-form') {
      const instructorId = Number($('a-instructor').value) || null;
      const venueId = Number($('a-venue').value) || null;

      if (draft.id) {
        // SCRUM-18: an existing class - save to the database. The server checks for clashes.
        const button = event.target.querySelector('button[type="submit"]');
        button.disabled = true;
        try {
          const saved = await api.put(`/classes/${draft.id}/assign`, { instructor_id: instructorId, venue_id: venueId });
          classes[draftIndex] = { ...saved, category: draft.category };   // category is page-only, keep it
        } catch (err) {
          // e.g. "Clash: Sensei X is already teaching "Aikido" at Bukit Timah CC (Saturday 16:00 - 17:00)."
          $('form-error').textContent = err.message;
          button.disabled = false;
          return;
        }
      } else {
        // A class created on this page is not in the database yet, so it stays on the page only.
        // TODO (backend): once POST /classes exists:  await api.post('/classes', draft);
        const instructor = instructors.find((i) => i.id === instructorId);
        const venue = venues.find((v) => v.id === venueId);
        draft.instructor_id = instructorId;
        draft.instructor = instructor ? instructor.name : null;
        draft.venue_id = venueId;
        draft.venue = venue ? venue.name : null;
        classes.push(draft);
      }
      view = 'timetable';
      tab = 'timetable';
    }

    if (formId === 'resource-form') {
      const value = $('r-value').value.trim();

      if (resource.kind === 'venue') {
        const taken = venuesHere().some((v) => v !== resource.item && v.name.toLowerCase() === value.toLowerCase());
        if (taken) {
          $('form-error').textContent = 'This centre already has a venue with that name.';
          return;
        }
        if (resource.item) {
          // Renaming: classes point to their venue by name, so update those too
          classesHere().forEach((c) => { if (c.venue === resource.item.name) c.venue = value; });
          resource.item.name = value;
        } else {
          venues.push({ id: null, name: value, centre_id: centre.id, centre: centre.name });
        }
        // TODO (backend): save it, e.g. api.post('/classes/venues', ...) or api.put('/classes/venues/' + id, ...)
        view = 'venues';
      } else {
        resource.item.availability = value;
        // TODO (backend): save the instructor's availability
        view = 'availability';
      }
    }

    render();
  });

  // ---------- Centre dropdown ----------
  $('centre').addEventListener('change', () => {
    centre = centres.find((c) => String(c.id) === $('centre').value);
    draft = null;
    resource = null;
    view = tab;
    render();
  });

  // ---------- Start ----------
  (async function load() {
    try {
      [centres, classes, venues, instructors] = await Promise.all([
        api.get('/centres'),
        api.get('/classes'),
        api.get('/classes/venues'),
        api.get('/classes/instructors'),
      ]);
      if (centres.length === 0) {
        $('panel').innerHTML = '<div class="empty">No centres yet. Add a centre first.</div>';
        return;
      }
      $('centre').innerHTML = centres.map((c) => `<option value="${esc(c.id)}">${esc(c.name)}</option>`).join('');
      centre = centres[0];
      render();
    } catch (err) {
      showError('#panel', err);
    }
  })();
})();