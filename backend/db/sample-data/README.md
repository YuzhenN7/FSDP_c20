# Sample data (temporary)

These CSV files are **our own stand-in data** until the client's real sample arrives.
You can open and edit them in Excel (save as "CSV UTF-8").

## Where it came from

| File | Source |
|---|---|
| `centres.csv`, `classes.csv` (days, times) | **Real**: public course listings on OnePA by Aikido Shinju-Kai International Pte Ltd (Thomson, Chong Pang, Paya Lebar Kovan, Bukit Timah, Punggol 21, West Coast) |
| Fee amounts in `fees.csv` | **Real amounts** from the same listings (term fee $107 to $150 depending on centre, one-time registration fee $60, annual membership $48) |
| `belts.csv` | **Assumed**: standard kyu ladder. The client's own belt levels are not published |
| `students.csv`, `instructors.csv`, `gradings.csv`, `attendance.csv`, `payments.csv`, who paid and who didn't | **Invented** |
| Venues, other than Thomson CC's "Level 3 Basketball Court" | **Placeholders** |

## Swapping in the real data (after Tuesday)

1. Put the real data into these same files (same column names), or make a new folder `backend/db/real-data/` with the same file names.
2. Stop the server, then run:
   - `npm run db:reload` (loads this folder), or
   - `npm run db:reload -- real-data` (loads `backend/db/real-data/`)
3. If the client's files look different (other column names, one big Excel sheet), ask the maintainer. Reshaping them into these CSVs is the only step needed. The app does not change.

Without Neon, the temporary local database reloads these files every time `npm run dev` restarts.

## Columns

Files link to each other by **name or email**, not ids, so the spelling must match exactly. Leave a cell empty if unknown.

| File | Columns |
|---|---|
| `belts.csv` | `name`, `sort_order` (1 = lowest belt) |
| `centres.csv` | `name`, `address` |
| `venues.csv` | `centre`, `name` |
| `instructors.csv` | `name`, `email`, `centre` |
| `classes.csv` | `centre`, `venue`, `instructor`, `name`, `day_of_week`, `start_time`, `end_time` (venue and instructor can be empty = not assigned yet) |
| `students.csv` | `name`, `email`, `centre`, `belt`, `joined_on` (optional `password`, otherwise `Student123!`) |
| `gradings.csv` | `student_email`, `belt`, `result` (`pass` or `fail`), `graded_on`, `notes` |
| `fees.csv` | `student_email`, `description`, `amount`, `due_date`, `status` (`paid` or `unpaid`) |
| `attendance.csv` | `centre`, `class_name`, `student_email`, `class_date`, `status` (`present` or `absent`) |
| `payments.csv` | `student_email`, `fee_description`, `amount`, `method`, `reference`, `paid_at` (the fee must exist in `fees.csv`) |

The admin account is not in a CSV. It is created by the setup script.
