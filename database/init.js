const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'attendance.db');
const db = new Database(dbPath);

// Enable WAL mode for better concurrency
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

function initialize() {
  // Create employees table
  db.exec(`
    CREATE TABLE IF NOT EXISTS employees (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'employee',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Create leaves table
  db.exec(`
    CREATE TABLE IF NOT EXISTS leaves (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id TEXT NOT NULL,
      employee_name TEXT NOT NULL,
      leave_type TEXT NOT NULL,
      from_date DATE NOT NULL,
      to_date DATE NOT NULL,
      reason TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      applied_on DATETIME DEFAULT CURRENT_TIMESTAMP,
      action_by TEXT,
      action_by_name TEXT,
      action_on DATETIME,
      FOREIGN KEY (employee_id) REFERENCES employees(employee_id)
    )
  `);

  // Create indexes for performance
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_leaves_employee_id ON leaves(employee_id);
    CREATE INDEX IF NOT EXISTS idx_leaves_status ON leaves(status);
    CREATE INDEX IF NOT EXISTS idx_leaves_from_date ON leaves(from_date);
    CREATE INDEX IF NOT EXISTS idx_leaves_to_date ON leaves(to_date);
    CREATE INDEX IF NOT EXISTS idx_employees_employee_id ON employees(employee_id);
  `);

  // Seed HR accounts if they don't exist
  const hrAccounts = [
    { employee_id: 'DIR001', name: 'Col (Dr.) Praveen Kumar Singh', password: 'admin@hr1' },
    { employee_id: 'DIR002', name: 'Akash Deep', password: 'admin@hr2' },
    { employee_id: 'DIR003', name: 'Lt Col Akshay Bahl', password: 'admin@hr3' },
  ];

  const insertHR = db.prepare(`
    INSERT OR IGNORE INTO employees (employee_id, name, password_hash, role)
    VALUES (?, ?, ?, 'hr')
  `);

  const seedTransaction = db.transaction(() => {
    for (const hr of hrAccounts) {
      const hash = bcrypt.hashSync(hr.password, 10);
      insertHR.run(hr.employee_id, hr.name, hash);
    }
  });

  seedTransaction();

  console.log('✅ Database initialized successfully');
}

module.exports = { db, initialize };
