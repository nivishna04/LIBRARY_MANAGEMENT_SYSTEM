/**
 * server.js — a small, plain Express API over the SQLite database in db.js.
 * Just what's needed to add/list/delete books and students, plus a tiny
 * endpoint to flip a book's status when it's issued/returned.
 */
const express = require("express");
const cors = require("cors");
const db = require("./db");

const app = express();
app.use(cors());
app.use(express.json());
const PORT = 3001;

// give new rows an id like BK009 / ST004 by looking at the last one
function nextId(prefix, table) {
  const row = db.prepare(`SELECT id FROM ${table} ORDER BY id DESC LIMIT 1`).get();
  if (!row) return `${prefix}001`;
  const n = parseInt(row.id.replace(prefix, ""), 10) + 1;
  return `${prefix}${String(n).padStart(3, "0")}`;
}

/* ---------------- BOOKS ---------------- */
app.get("/api/books", (req, res) => {
  res.json(db.prepare("SELECT * FROM books ORDER BY title ASC").all());
});

app.post("/api/books", (req, res) => {
  const { title, author, category, isbn } = req.body;
  if (!title || !author || !category || !isbn) {
    return res.status(400).json({ error: "title, author, category, and isbn are all required" });
  }
  const existing = db.prepare("SELECT id FROM books WHERE isbn = ?").get(isbn);
  if (existing) return res.status(409).json({ error: "A book with this ISBN already exists" });

  const id = nextId("BK", "books");
  db.prepare("INSERT INTO books (id,title,author,category,isbn,status) VALUES (?,?,?,?,?,'available')")
    .run(id, title, author, category, isbn);
  res.status(201).json(db.prepare("SELECT * FROM books WHERE id=?").get(id));
});

app.put("/api/books/:id/status", (req, res) => {
  const { status } = req.body; // 'available' | 'issued'
  const book = db.prepare("SELECT * FROM books WHERE id=?").get(req.params.id);
  if (!book) return res.status(404).json({ error: "Book not found" });
  db.prepare("UPDATE books SET status=? WHERE id=?").run(status, req.params.id);
  res.json(db.prepare("SELECT * FROM books WHERE id=?").get(req.params.id));
});

app.delete("/api/books/:id", (req, res) => {
  const book = db.prepare("SELECT * FROM books WHERE id=?").get(req.params.id);
  if (!book) return res.status(404).json({ error: "Book not found" });
  db.prepare("DELETE FROM books WHERE id=?").run(req.params.id);
  res.json({ ok: true });
});

/* ---------------- STUDENTS ---------------- */
app.get("/api/students", (req, res) => {
  res.json(db.prepare("SELECT * FROM students ORDER BY name ASC").all());
});

app.post("/api/students", (req, res) => {
  const { name, email } = req.body;
  if (!name || !email) return res.status(400).json({ error: "name and email are required" });
  const existing = db.prepare("SELECT id FROM students WHERE email = ?").get(email);
  if (existing) return res.status(409).json({ error: "A student with this email already exists" });

  const id = nextId("ST", "students");
  db.prepare("INSERT INTO students (id,name,email,status) VALUES (?,?,?,'Active')").run(id, name, email);
  res.status(201).json(db.prepare("SELECT * FROM students WHERE id=?").get(id));
});

app.delete("/api/students/:id", (req, res) => {
  const student = db.prepare("SELECT * FROM students WHERE id=?").get(req.params.id);
  if (!student) return res.status(404).json({ error: "Student not found" });
  db.prepare("DELETE FROM students WHERE id=?").run(req.params.id);
  res.json({ ok: true });
});

app.listen(PORT, () => console.log(`EclipseSoul simple API running at http://localhost:${PORT}`));
