# Aikido Shinjukai: Centralised Administrative Workflow System

Starter project for the team. Login, register, navigation and a page + API route for every feature are already in place. Each person fills in their own features.

**Stack:** Node.js + Express (API in `backend/`) · PostgreSQL on Neon · plain HTML/CSS/JS pages (in `frontend/`, no React, no build step).
The API (`/api/...`) is separate from the pages, so a mobile app or AI features can use the same API later.

## Run it (first time)

You need [Node.js](https://nodejs.org) 20 or newer. In VS Code, open a terminal (Terminal > New Terminal), then:

```
cd backend
npm install
copy .env.example .env
npm run dev
```

(On Mac use `cp` instead of `copy`.) Open http://localhost:3000. The server also serves the pages from `frontend/`, so that is the only thing you need to run.

Logins (development only):

| Role | Email | Password |
|---|---|---|
| Admin | `admin@shinjukai.test` | `Admin123!` |
| Student | `student@shinjukai.test` | `Student123!` |

`npm run dev` restarts itself when you save a backend file. After editing a page in `frontend/`, just refresh the browser. Stop it with `Ctrl + C`.

## Before Neon is set up

If `DATABASE_URL` in `backend/.env` is empty, the app uses a **temporary database in memory**. Every time the server restarts, it is rebuilt from the CSV files in `backend/db/sample-data/`. So anything you add while testing disappears on restart, and each person has their own separate copy. That's fine for building pages and features.

## When Neon is ready

1. One person creates the Neon project and copies the connection string (Neon dashboard > Connect).
2. Everyone puts it in their own `backend/.env` as `DATABASE_URL=...` (share it privately, never commit `.env`).
3. **One person only**, inside `backend`, runs `npm run db:setup`. This creates the tables, the admin account, and loads the sample data.
4. Everyone restarts `npm run dev`. The whole team now shares one database.

## Sample data and swapping in the real data

The sample data is in `backend/db/sample-data/*.csv` and is explained in `backend/db/sample-data/README.md`. Short version: the centres, class days/times and fee amounts come from the public OnePA course listings; students, instructors, gradings, attendance and payments are invented; the belt ladder is an assumption.

When the real data arrives:

1. Put it in the same CSV files (same column names), or in a new folder `backend/db/real-data/`.
2. Stop the server, then inside `backend` run `npm run db:reload` (or `npm run db:reload -- real-data`).

On Neon, `db:reload` **wipes the shared data for everyone**, so tell the team first. If the real files look different from ours, reshape them into these CSVs; the app itself doesn't change.

## Folder map

```
backend/
  server.js             starts the server
  app.js                connects every route file to its URL
  config/db.js          database connection (use db.query in models)
  middleware/auth.js    requireAuth / requireRole checks
  routes/               which URL goes to which controller      } ONE SET OF
  controllers/          reads the request, sends the answer     } THREE FILES
  models/               the SQL queries                         } PER FEATURE
  services/emailService.js   receipt email (prints to terminal for now)
  db/schema.sql         all the tables
  db/sample-data/       the CSV files
  scripts/              db:setup and db:reload
frontend/
  login.html, register.html, index.html
  admin/                one page per admin feature
  student/              one page per student feature
  css/styles.css        shared look (colours from Figma)
  js/api.js             talks to the API  (api.get / api.post ...)
  js/ui.js              helpers (renderTable, formatMoney ...)
  js/layout.js          top bar + menu + "are you allowed here" check
docs/
  api-contract.md       every endpoint and whether it is built yet
  git-guide.md          how we use branches
```

## Who works on what (suggested, from the sprint 1 split)

| Area | Backend files (`routes` / `controllers` / `models`) | Pages in `frontend/` |
|---|---|---|
| Grading and belts | `grading*`, `belt*` | `admin/grading.html`, `admin/belts.html`, `student/belt.html` |
| Foundation and scheduling | `centre*`, `class*`, `member*`, `attendance*` | `admin/centres.html`, `classes.html`, `members.html`, `attendance.html` |
| Online payments | `studentPortal*` (the pay part), `services/emailService.js` | `student/fees.html`, `payment-success.html`, `payment-history.html` |
| Payment tracking and reporting | `fee*`, `payment*`, `report*` | `admin/fees.html`, `payments.html`, `reports.html`, `dashboard.html` |

(`centre*` means `routes/centreRoutes.js`, `controllers/centreController.js` and `models/centreModel.js`.)

Every feature already shows a working example (it lists the data), with `TODO` comments for what's missing. Stick to your own files and you will almost never get Git conflicts.

## Shared files: tell the team before changing these

- `backend/db/schema.sql` (the tables). After a change, tell the maintainer. The setup only creates *missing* tables, so changes to existing tables need care.
- `frontend/js/layout.js` (the menu), `frontend/css/styles.css`, `backend/middleware/auth.js`, `backend/app.js`.
- `docs/api-contract.md`: do update this one whenever you build an endpoint.

## How to add a feature (example: "add a centre")

1. **Model** (`backend/models/centreModel.js`): add the SQL.
   ```js
   async function createCentre(name, address) {
     const { rows } = await db.query(
       'INSERT INTO centres (name, address) VALUES ($1, $2) RETURNING *',
       [name, address]
     );
     return rows[0];
   }
   ```
   and add `createCentre` to `module.exports`.
2. **Controller** (`backend/controllers/centreController.js`):
   ```js
   async function createCentre(req, res) {
     const { name, address } = req.body;
     if (!name) return res.status(400).json({ error: 'Name is required.' });
     res.status(201).json(await centreModel.createCentre(name, address));
   }
   ```
   and add it to `module.exports`.
3. **Route** (`backend/routes/centreRoutes.js`): `router.post('/', centreController.createCentre);`
4. **Page** (`frontend/admin/centres.html`): add a form and call `await api.post('/centres', { name, address })`, then reload the list.
5. Update `docs/api-contract.md`.

Always pass values as `$1, $2...` in SQL (never paste user input into the SQL text), and wrap anything from the database in `esc(...)` when putting it into HTML (`renderTable` does this for you).

## Notes

- Public registration only creates **student** accounts. There is one admin account, created by setup.
- Still a placeholder: online payment (`POST /api/student/fees/:id/pay` returns "not built yet"), real email sending, and every "add / edit / delete" action.
- The sample logins and the admin password are for development. Change them before anything real is stored.
