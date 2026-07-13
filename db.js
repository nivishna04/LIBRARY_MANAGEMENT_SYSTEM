/**
 * db.js — a small SQLite database, nothing fancy.
 * Two tables: books and students. Opens/creates eclipsesoul.db next to
 * this file and seeds a few starter rows the first time it runs.
 */
const path = require("path");
const Database = require("better-sqlite3");

const db = new Database(path.join(__dirname, "eclipsesoul.db"));

db.exec(`
CREATE TABLE IF NOT EXISTS books (
  id       TEXT PRIMARY KEY,
  title    TEXT NOT NULL,
  author   TEXT NOT NULL,
  category TEXT NOT NULL,
  isbn     TEXT UNIQUE NOT NULL,
  status   TEXT NOT NULL DEFAULT 'available'
);

CREATE TABLE IF NOT EXISTS students (
  id     TEXT PRIMARY KEY,
  name   TEXT NOT NULL,
  email  TEXT UNIQUE NOT NULL,
  status TEXT NOT NULL DEFAULT 'Active'
);
`);

// seed once, on first run
if (db.prepare("SELECT COUNT(*) c FROM books").get().c === 0) {
  const insertBook = db.prepare(
    "INSERT INTO books (id,title,author,category,isbn,status) VALUES (?,?,?,?,?,?)"
  );
  [
    ["BK001", "Artificial Intelligence: A Modern Approach", "Russell & Norvig", "Artificial Intelligence", "978-0134610993", "available"],
    ["BK002", "Deep Learning", "Goodfellow, Bengio & Courville", "Artificial Intelligence", "978-0262035613", "available"],
    ["BK003", "Neural Networks & Deep Learning", "Michael Nielsen", "Artificial Intelligence", "978-1502775370", "issued"],
    ["BK004", "Dune", "Frank Herbert", "Fiction", "978-0441172719", "available"],
    ["BK005", "A Brief History of Time", "Stephen Hawking", "Physics", "978-0553380163", "available"],
    ["BK006", "Introduction to Algorithms", "Cormen, Leiserson, Rivest, Stein", "Computer Science", "978-0262046305", "available"],
    ["BK007", "Clean Code", "Robert C. Martin", "Computer Science", "978-0132350884", "issued"],
    ["BK008", "Sapiens", "Yuval Noah Harari", "History", "978-0062316097", "available"],
  ].forEach((b) => insertBook.run(...b));
}

if (db.prepare("SELECT COUNT(*) c FROM students").get().c === 0) {
  const insertStudent = db.prepare("INSERT INTO students (id,name,email,status) VALUES (?,?,?,?)");
  [
    ["ST001", "Eleven Hopper", "eleven@eclipsesoul.edu", "Active"],
    ["ST002", "Mike Wheeler", "mike@eclipsesoul.edu", "Active"],
    ["ST003", "Max Mayfield", "max@eclipsesoul.edu", "Active"],
  ].forEach((s) => insertStudent.run(...s));
}

module.exports = db;
