const Database = require("better-sqlite3");
const path = require("path");

const db = new Database(path.join(__dirname, "data.db"));

db.exec(`
  CREATE TABLE IF NOT EXISTS locations (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    name             TEXT NOT NULL,
    address          TEXT,
    phone            TEXT,
    latitude         REAL,
    longitude        REAL,
    google_place_id  TEXT UNIQUE,
    last_called      DATETIME,
    space_available  INTEGER,
    created_at       DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at       DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

module.exports = db;
