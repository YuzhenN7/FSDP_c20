const pool = require('../config/db')

// Gets SESSION and STUDENTS approved/pending
const SESSION_SELECT =
    "SELECT s.*, " +
    "COUNT(a.*) FILTER (WHERE a.status = 'approved')::int AS approved_count, " +
    "COUNT(a.*) FILTER (WHERE a.status = 'pending')::int AS pending_count " +
    "FROM grading_sessions s " +
    "LEFT JOIN grading_applications a ON a.session_id = s.session_id ";

//Get SESSION
async function fetchSession(client, id) {
    const result = await client.query( 
        SESSION_SELECT + "WHERE s.session_id", [id])
        return result.rows[0] || null;
}

// Insert new grading SESSION
async function createSession(d) {
    const client = await pool.connect();
    try{
        const result = await client.query(
            "INSERT INTO grading_sessions " +
            "(type, dojo, venue, session_date, session_time, fee, apply_open, apply_close, capacity) " +
            "VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *",
            [d.type, d.dojo, d.venue, d.session_date, d.session_time, d.fee, d.apply_open, d.apply_close, d.capacity]
        )
        return result.rows[0]
    } finally {
        client.release();
    }
}

//