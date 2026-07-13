/* ==========================================================================
   ECLIPSESOUL LIBRARY — front-end demo logic
   Everything here runs client-side with mock/local data. There is no real
   Supabase, Gemini, or Three.js backend wired up — this is a self-contained
   HTML/CSS/JS prototype that demonstrates the theme, flows, and interactions
   described in the brief.
   ========================================================================== */

(() => {
"use strict";

/* ---------------------------------------------------------------------
   API — talks to /backend (run `npm install && npm start` there first)
--------------------------------------------------------------------- */
const API_BASE = window.ECLIPSESOUL_API_BASE || "http://localhost:3001/api";

async function api(path, opts) {
  const res = await fetch(API_BASE + path, { headers: { "Content-Type": "application/json" }, ...(opts || {}) });
  let data = null;
  try { data = await res.json(); } catch (_) {}
  if (!res.ok) throw new Error((data && data.error) || `Request failed (${res.status})`);
  return data;
}

async function loadBooks() {
  const rows = await api("/books");
  BOOKS = rows.map((b, i) => ({ ...b, cat: b.category, cover: COVERS[i % COVERS.length] }));
}
async function loadStudents() {
  const rows = await api("/students");
  STUDENTS = rows.map((s) => ({ ...s, issued: 0, fines: 0 }));
}

/* ---------------------------------------------------------------------
   0. MOCK DATA
--------------------------------------------------------------------- */
const CATEGORIES = ["Artificial Intelligence","Fiction","Physics","Mathematics","History","Computer Science","Biology","Philosophy"];

const COVERS = [
  "linear-gradient(145deg,#7c3aed,#3fa9f5)",
  "linear-gradient(145deg,#fb923c,#8b5cf6)",
  "linear-gradient(145deg,#3fa9f5,#22c55e)",
  "linear-gradient(145deg,#f472b6,#8b5cf6)",
  "linear-gradient(145deg,#facc15,#fb923c)",
  "linear-gradient(145deg,#8b5cf6,#22d3ee)"
];

// Books and students now come from the database (see loadBooks/loadStudents
// above and enterApp below) — these just start empty until that loads.
let BOOKS = [];
let STUDENTS = [];

let TRANSACTIONS = [
  {book:"Neural Networks & Deep Learning", student:"Mike Wheeler", issued:"2026-06-28", due:"2026-07-12", status:"due", fine:0},
  {book:"Dune", student:"Max Mayfield", issued:"2026-06-15", due:"2026-06-29", status:"overdue", fine:5},
  {book:"Clean Code", student:"Eleven Hopper", issued:"2026-07-02", due:"2026-07-16", status:"ok", fine:0},
];

let RESERVATIONS = [
  {book:"Deep Learning", student:"Dustin Henderson", date:"2026-07-08", status:"Pending"},
  {book:"A Brief History of Time", student:"Max Mayfield", date:"2026-07-09", status:"Ready for pickup"},
];

let FINES = [
  {student:"Max Mayfield", book:"Dune", amount:5, reason:"Overdue 5 days", status:"Unpaid"},
  {student:"Mike Wheeler", book:"Sapiens", amount:2, reason:"Late return", status:"Paid"},
];

let NOTIFICATIONS = [
  {title:"Book due tomorrow", body:"“Neural Networks & Deep Learning” is due Jul 12.", time:"2h ago"},
  {title:"Reservation ready", body:"“A Brief History of Time” is ready for pickup.", time:"5h ago"},
  {title:"New arrivals", body:"6 new Computer Science titles just landed.", time:"1d ago"},
  {title:"Fine reminder", body:"You have an unpaid fine of $5.00.", time:"2d ago"},
];

const SEAT_COUNT = 40;
let SEATS = Array.from({length:SEAT_COUNT}, (_,i)=>({
  id: i+1,
  status: Math.random() < 0.28 ? "taken" : "free"
}));

/* ---------------------------------------------------------------------
   1. NAV CONFIG PER ROLE
--------------------------------------------------------------------- */
const NAV = {
  student: [
    ["overview","◈","Overview"],
    ["books","📚","Browse Books"],
    ["transactions","📖","My Books"],
    ["reservations","🔖","Reservations"],
    ["seats","🪑","Seat Booking"],
    ["scanner","▦","QR Scanner"],
    ["profile","👤","Profile"],
  ],
  librarian: [
    ["overview","◈","Overview"],
    ["books","📚","Manage Books"],
    ["transactions","📖","Issue / Return"],
    ["reservations","🔖","Reservations"],
    ["students","🧑‍🎓","Students"],
    ["fines","💰","Fines"],
    ["seats","🪑","Seats"],
    ["scanner","▦","Scanner"],
    ["profile","👤","Profile"],
  ],
  admin: [
    ["overview","◈","Analytics"],
    ["books","📚","Books"],
    ["students","🧑‍🎓","Students & Librarians"],
    ["transactions","📖","Transactions"],
    ["fines","💰","Fine Rules"],
    ["seats","🪑","Seat Management"],
    ["reports","📊","Reports"],
    ["profile","👤","Profile"],
  ],
};

/* ---------------------------------------------------------------------
   2. STATE
--------------------------------------------------------------------- */
let state = {
  role: "student",
  authMode: "login",
  user: null,
  activeView: "overview",
  companion: "lyra",
};

/* ---------------------------------------------------------------------
   3. CUSTOM CURSOR + SPORE FIELD
--------------------------------------------------------------------- */
const cursorCore = document.getElementById("cursor-core");
const cursorCorona = document.getElementById("cursor-corona");
const trailCanvas = document.getElementById("cursor-trail");
const tctx = trailCanvas.getContext("2d");
let trailPts = [];
let mouse = {x: innerWidth/2, y: innerHeight/2};
let lastMouse = {...mouse};

function resizeCanvases(){
  trailCanvas.width = innerWidth; trailCanvas.height = innerHeight;
  sporeCanvas.width = innerWidth; sporeCanvas.height = innerHeight;
}
window.addEventListener("resize", resizeCanvases);

window.addEventListener("pointermove", (e)=>{
  mouse.x = e.clientX; mouse.y = e.clientY;
  cursorCore.style.left = mouse.x+"px"; cursorCore.style.top = mouse.y+"px";
  cursorCorona.style.left = mouse.x+"px"; cursorCorona.style.top = mouse.y+"px";
  trailPts.push({x:mouse.x,y:mouse.y,life:1});
  if(trailPts.length>26) trailPts.shift();
});
document.addEventListener("pointerdown", ()=>{
  document.body.classList.add("cursor-grow");
  spawnClickBurst(mouse.x, mouse.y);
});
document.addEventListener("pointerup", ()=> document.body.classList.remove("cursor-grow"));
document.addEventListener("mouseover", (e)=>{
  if(e.target.closest("button,a,input,select,.nav-item,.book-card,.seat")) document.body.classList.add("cursor-grow");
});
document.addEventListener("mouseout", (e)=>{
  if(e.target.closest("button,a,input,select,.nav-item,.book-card,.seat")) document.body.classList.remove("cursor-grow");
});

let bursts = [];
function spawnClickBurst(x,y){
  for(let i=0;i<14;i++){
    const a = (Math.PI*2*i)/14;
    bursts.push({x,y,vx:Math.cos(a)*(2+Math.random()*2),vy:Math.sin(a)*(2+Math.random()*2),life:1,
      color:["#8b5cf6","#3fa9f5","#fb923c"][i%3]});
  }
}

function drawTrail(){
  tctx.clearRect(0,0,trailCanvas.width,trailCanvas.height);
  trailPts.forEach((p,i)=>{
    p.life -= 0.045;
    const r = 5*(i/trailPts.length);
    tctx.beginPath();
    tctx.arc(p.x,p.y,Math.max(r,0.5),0,Math.PI*2);
    tctx.fillStyle = `rgba(139,92,246,${Math.max(p.life*0.35,0)})`;
    tctx.fill();
  });
  trailPts = trailPts.filter(p=>p.life>0);

  bursts.forEach(b=>{
    b.x += b.vx; b.y += b.vy; b.life -= 0.03;
    tctx.beginPath();
    tctx.arc(b.x,b.y,2.4,0,Math.PI*2);
    tctx.fillStyle = b.color;
    tctx.globalAlpha = Math.max(b.life,0);
    tctx.fill();
    tctx.globalAlpha = 1;
  });
  bursts = bursts.filter(b=>b.life>0);

  requestAnimationFrame(drawTrail);
}

/* ---- ambient drifting spores (Upside-Down atmosphere) ---- */
const sporeCanvas = document.getElementById("spore-field");
const sctx = sporeCanvas.getContext("2d");
let spores = Array.from({length:70}, ()=>({
  x: Math.random()*innerWidth, y: Math.random()*innerHeight,
  r: 0.6+Math.random()*2.2, spd: 0.15+Math.random()*0.4,
  drift: Math.random()*Math.PI*2,
  hue: ["#8b5cf6","#3fa9f5","#fb923c"][Math.floor(Math.random()*3)]
}));
function drawSpores(){
  sctx.clearRect(0,0,sporeCanvas.width,sporeCanvas.height);
  spores.forEach(s=>{
    s.y -= s.spd;
    s.x += Math.sin(s.drift + s.y*0.01) * 0.25;
    if(s.y < -10){ s.y = innerHeight+10; s.x = Math.random()*innerWidth; }
    sctx.beginPath();
    sctx.arc(s.x,s.y,s.r,0,Math.PI*2);
    sctx.fillStyle = s.hue;
    sctx.globalAlpha = 0.35;
    sctx.shadowColor = s.hue; sctx.shadowBlur = 6;
    sctx.fill();
    sctx.globalAlpha = 1; sctx.shadowBlur = 0;
  });
  requestAnimationFrame(drawSpores);
}

resizeCanvases();
drawTrail();
drawSpores();

/* ---------------------------------------------------------------------
   4. GATE / LOADING SEQUENCE
--------------------------------------------------------------------- */
const gateScreen = document.getElementById("gate-screen");
const gateFill = document.getElementById("gate-progress-fill");
let gateProgress = 0;
const gateInterval = setInterval(()=>{
  gateProgress += 4 + Math.random()*8;
  if(gateProgress >= 100){
    gateProgress = 100;
    clearInterval(gateInterval);
    setTimeout(()=>{
      gateScreen.style.transition = "opacity .6s ease, transform .6s ease";
      gateScreen.style.opacity = "0";
      gateScreen.style.transform = "scale(1.05)";
      setTimeout(()=>{
        gateScreen.classList.add("hidden");
        document.getElementById("auth-screen").classList.remove("hidden");
      }, 550);
    }, 250);
  }
  gateFill.style.width = gateProgress+"%";
}, 140);

/* ---------------------------------------------------------------------
   5. AUTH SCREEN LOGIC
--------------------------------------------------------------------- */
const roleTabs = document.querySelectorAll(".role-tab");
const modeBtns = document.querySelectorAll(".mode-btn");
const fieldName = document.getElementById("field-name");
const fieldPassword = document.getElementById("field-password");
const authSubmit = document.getElementById("auth-submit");
const authNote = document.getElementById("auth-note");
const authForm = document.getElementById("auth-form");

roleTabs.forEach(tab=>{
  tab.addEventListener("click", ()=>{
    roleTabs.forEach(t=>t.classList.remove("active"));
    tab.classList.add("active");
    state.role = tab.dataset.role;
  });
});

modeBtns.forEach(btn=>{
  btn.addEventListener("click", ()=>{
    modeBtns.forEach(b=>b.classList.remove("active"));
    btn.classList.add("active");
    state.authMode = btn.dataset.mode;
    fieldName.style.display = state.authMode === "register" ? "block" : "none";
    fieldPassword.style.display = state.authMode === "forgot" ? "none" : "block";
    authSubmit.textContent = {
      login: "Enter the Library",
      register: "Create Account",
      forgot: "Send Reset Link"
    }[state.authMode];
    authNote.textContent = state.authMode === "forgot"
      ? "Demo mode — this simulates sending a reset email. No email is actually sent."
      : "Demo mode — any email/password combination works. No real accounts are created.";
  });
});

authForm.addEventListener("submit", (e)=>{
  e.preventDefault();
  const email = document.getElementById("auth-email").value || "guest@eclipsesoul.edu";
  const name = document.getElementById("reg-name").value;

  if(state.authMode === "forgot"){
    authNote.textContent = "✓ Reset link sent (simulated). Check your inbox.";
    authNote.style.color = "var(--success)";
    return;
  }

  const displayName = name || email.split("@")[0].replace(/\./g," ").replace(/\b\w/g, c=>c.toUpperCase());
  state.user = { name: displayName, email, role: state.role };
  enterApp();
});

/* ---------------------------------------------------------------------
   6. ENTER APP
--------------------------------------------------------------------- */
async function enterApp(){
  document.getElementById("auth-screen").classList.add("hidden");
  const app = document.getElementById("app");
  app.classList.remove("hidden");

  document.getElementById("side-user-name").textContent = state.user.name;
  document.getElementById("side-user-role").textContent = state.user.role;
  document.getElementById("profile-name").textContent = state.user.name;
  document.getElementById("profile-email").textContent = state.user.email;

  buildNav();

  try {
    await Promise.all([loadBooks(), loadStudents()]);
  } catch (err) {
    notify("Database not reachable", "Start the API in /backend (npm install && npm start) to load real books and students.");
  }

  populateCategoryFilter();
  renderAll();
  switchView("overview");
  pushWelcomeNotification();
}

function pushWelcomeNotification(){
  NOTIFICATIONS.unshift({
    title:`Welcome back, ${state.user.name.split(" ")[0]}`,
    body:`Signed in as ${state.user.role}. The gate is open.`,
    time:"now"
  });
  renderNotifications();
}

/* ---------------------------------------------------------------------
   7. SIDEBAR NAV
--------------------------------------------------------------------- */
function buildNav(){
  const nav = document.getElementById("side-nav");
  nav.innerHTML = "";
  NAV[state.role].forEach(([id,icon,label])=>{
    const btn = document.createElement("button");
    btn.className = "nav-item" + (id === state.activeView ? " active" : "");
    btn.innerHTML = `<span class="nav-icon">${icon}</span><span>${label}</span>`;
    btn.addEventListener("click", ()=> switchView(id));
    btn.dataset.view = id;
    nav.appendChild(btn);
  });
}

const VIEW_TITLES = {
  overview:"Dashboard", books:"Book Catalog", transactions:"Transactions",
  reservations:"Reservations", seats:"Seat Reservation", students:"Students",
  fines:"Fines", scanner:"QR / Barcode Scanner", reports:"Reports & Analytics", profile:"My Profile"
};

function switchView(id){
  state.activeView = id;
  document.querySelectorAll(".nav-item").forEach(n=> n.classList.toggle("active", n.dataset.view===id));
  document.querySelectorAll(".view").forEach(v=> v.hidden = true);
  const el = document.getElementById("view-"+id);
  if(el) el.hidden = false;
  document.getElementById("section-title").textContent = VIEW_TITLES[id] || "Dashboard";
  document.getElementById("content-scroll").scrollTop = 0;
  document.querySelector(".sidebar").classList.remove("open");

  if(id === "reports") drawCharts();
}

document.getElementById("sidebar-toggle").addEventListener("click", ()=>{
  document.querySelector(".sidebar").classList.toggle("open");
});

document.getElementById("logout-btn").addEventListener("click", ()=>{
  document.getElementById("app").classList.add("hidden");
  document.getElementById("auth-screen").classList.remove("hidden");
  authForm.reset();
  state.user = null;
});

/* ---------------------------------------------------------------------
   8. RENDER: OVERVIEW
--------------------------------------------------------------------- */
function renderOverview(){
  const grid = document.getElementById("stat-grid");
  let cards = [];
  if(state.role === "student"){
    cards = [
      ["c-violet","📖","Books Issued", TRANSACTIONS.filter(t=>t.student===state.user.name || true).length],
      ["c-blue","🔖","Active Reservations", RESERVATIONS.length],
      ["c-ember","💰","Fine Balance", "$" + FINES.filter(f=>f.status==="Unpaid").reduce((a,f)=>a+f.amount,0).toFixed(2)],
      ["c-green","🪑","Seats Free", SEATS.filter(s=>s.status==="free").length],
    ];
  } else if(state.role === "librarian"){
    cards = [
      ["c-violet","📚","Total Books", BOOKS.length],
      ["c-blue","📖","Issued Today", TRANSACTIONS.length],
      ["c-ember","🔖","Pending Reservations", RESERVATIONS.filter(r=>r.status==="Pending").length],
      ["c-green","🧑‍🎓","Active Students", STUDENTS.filter(s=>s.status==="Active").length],
    ];
  } else {
    cards = [
      ["c-violet","📚","Total Books", BOOKS.length],
      ["c-blue","🧑‍🎓","Students", STUDENTS.length],
      ["c-ember","💰","Fines Collected", "$"+FINES.filter(f=>f.status==="Paid").reduce((a,f)=>a+f.amount,0).toFixed(2)],
      ["c-green","🪑","Occupancy", Math.round(SEATS.filter(s=>s.status==="taken").length/SEATS.length*100)+"%"],
    ];
  }
  grid.innerHTML = cards.map(([c,icon,label,num])=>`
    <div class="glass stat-card ${c}">
      <div class="stat-icon">${icon}</div>
      <div class="stat-num">${num}</div>
      <div class="stat-label">${label}</div>
    </div>`).join("");

  document.getElementById("activity-list").innerHTML = NOTIFICATIONS.slice(0,5).map(n=>`
    <li><span>${n.title}</span><time>${n.time}</time></li>`).join("");

  document.getElementById("arrivals-row").innerHTML = BOOKS.slice(0,6).map(b=>`
    <div class="mini-book">
      <div class="cover" style="background:${b.cover}">${b.cat}</div>
      <p>${b.title}</p>
    </div>`).join("");
}

/* ---------------------------------------------------------------------
   9. RENDER: BOOKS
--------------------------------------------------------------------- */
function populateCategoryFilter(){
  const sel = document.getElementById("book-category");
  sel.innerHTML = `<option value="">All Categories</option>` +
    CATEGORIES.map(c=>`<option value="${c}">${c}</option>`).join("");
  if(state.role !== "student") document.getElementById("add-book-btn").hidden = false;
}

function renderBooks(){
  const q = document.getElementById("book-search").value.toLowerCase();
  const cat = document.getElementById("book-category").value;
  const list = BOOKS.filter(b =>
    (!cat || b.cat===cat) &&
    (b.title.toLowerCase().includes(q) || b.author.toLowerCase().includes(q) || b.isbn.includes(q) || b.cat.toLowerCase().includes(q))
  );
  const grid = document.getElementById("book-grid");
  if(!list.length){ grid.innerHTML = `<p class="muted">No books match your search.</p>`; return; }

  grid.innerHTML = list.map(b => `
    <div class="glass book-card">
      <div class="cover" style="background:${b.cover}">${b.cat}</div>
      <div class="book-title">${b.title}</div>
      <div class="book-author">${b.author}</div>
      <div class="book-meta">
        <span class="status-pill ${b.status}">${b.status === "available" ? "Available" : "Issued"}</span>
        <span style="font-family:var(--font-mono);font-size:10px;color:var(--ink-2)">${b.id}</span>
      </div>
      ${state.role === "student"
        ? `<button class="book-action" data-id="${b.id}" data-act="${b.status==='available'?'borrow':'reserve'}" ${false?'disabled':''}>
             ${b.status === "available" ? "Borrow" : "Reserve"}
           </button>`
        : `<button class="book-action" data-id="${b.id}" data-act="issue">${b.status==='available' ? 'Issue to Student' : 'Mark Returned'}</button>
           <button class="tbl-btn" data-delete-book="${b.id}" style="margin-top:6px;width:100%;text-align:center">Delete</button>`
      }
    </div>`).join("");
}

document.getElementById("book-search").addEventListener("input", renderBooks);
document.getElementById("book-category").addEventListener("change", renderBooks);

document.getElementById("add-book-btn").addEventListener("click", async ()=>{
  const title = prompt("Book title?");
  if(!title) return;
  const author = prompt("Author?");
  if(!author) return;
  const category = prompt(`Category? (${CATEGORIES.join(", ")})`, CATEGORIES[0]);
  if(!category) return;
  const isbn = prompt("ISBN?");
  if(!isbn) return;

  try {
    await api("/books", { method:"POST", body: JSON.stringify({ title, author, category, isbn }) });
    await loadBooks();
    renderBooks(); renderOverview();
    notify("Book added", `“${title}” is now in the catalog.`);
  } catch (err) {
    notify("Couldn't add book", err.message);
  }
});

document.getElementById("book-grid").addEventListener("click", async (e)=>{
  const btn = e.target.closest(".book-action, [data-delete-book]");
  if(!btn) return;
  const id = btn.dataset.id || btn.dataset.deleteBook;
  const book = BOOKS.find(b=>b.id===id);
  if(!book) return;

  try {
    if(btn.dataset.act === "borrow"){
      book.status = "issued";
      await api(`/books/${book.id}/status`, { method:"PUT", body: JSON.stringify({ status:"issued" }) });
      TRANSACTIONS.unshift({book:book.title, student:state.user.name, issued: todayStr(), due: addDays(14), status:"ok", fine:0});
      notify(`“${book.title}” borrowed`, `Due back on ${addDays(14)}.`);
    } else if(btn.dataset.act === "reserve"){
      RESERVATIONS.unshift({book:book.title, student:state.user.name, date: todayStr(), status:"Pending"});
      notify(`Reservation placed`, `We'll notify you when “${book.title}” is available.`);
    } else if(btn.dataset.act === "issue"){
      book.status = book.status === "available" ? "issued" : "available";
      await api(`/books/${book.id}/status`, { method:"PUT", body: JSON.stringify({ status: book.status }) });
      notify(book.status === "issued" ? "Book issued" : "Book returned", `“${book.title}” updated.`);
    } else if(btn.dataset.deleteBook){
      if(!confirm(`Delete “${book.title}” permanently?`)) return;
      await api(`/books/${book.id}`, { method:"DELETE" });
      await loadBooks();
      notify("Book deleted", `“${book.title}” was removed.`);
    }
  } catch (err) {
    notify("Action failed", err.message);
  }
  renderBooks(); renderTransactions(); renderReservations(); renderOverview();
});

/* ---------------------------------------------------------------------
   10. RENDER: TRANSACTIONS / RESERVATIONS / STUDENTS / FINES
--------------------------------------------------------------------- */
function renderTransactions(){
  const rows = state.role === "student" ? TRANSACTIONS.filter(t=>t.student===state.user.name) : TRANSACTIONS;
  document.getElementById("transactions-body").innerHTML = (rows.length ? rows : []).map(t=>`
    <tr>
      <td>${t.book}</td><td>${t.student}</td><td>${t.issued}</td><td>${t.due}</td>
      <td><span class="pill-status ${t.status}">${t.status}</span></td>
      <td>${t.fine ? "$"+t.fine.toFixed(2) : "—"}</td>
      <td><button class="tbl-btn" data-return="${t.book}">${state.role==='student' ? 'Renew' : 'Return'}</button></td>
    </tr>`).join("") || `<tr><td colspan="7" class="muted" style="text-align:center;padding:20px">No records yet.</td></tr>`;
}

function renderReservations(){
  const rows = state.role === "student" ? RESERVATIONS.filter(r=>r.student===state.user.name) : RESERVATIONS;
  document.getElementById("reservations-body").innerHTML = rows.map(r=>`
    <tr>
      <td>${r.book}</td><td>${r.student}</td><td>${r.date}</td>
      <td><span class="pill-status ${r.status==='Pending'?'due':'ok'}">${r.status}</span></td>
      <td><button class="tbl-btn" data-cancel="${r.book}">Cancel</button></td>
    </tr>`).join("") || `<tr><td colspan="5" class="muted" style="text-align:center;padding:20px">No reservations.</td></tr>`;
}

function renderStudents(){
  const staff = state.role !== "student";
  document.getElementById("students-body").innerHTML = STUDENTS.map(s=>`
    <tr>
      <td>${s.name}</td><td>${s.email}</td><td>${s.issued}</td>
      <td>${s.fines ? "$"+s.fines.toFixed(2) : "—"}</td>
      <td><span class="pill-status ${s.status==='Active'?'ok':'overdue'}">${s.status}</span></td>
      <td>${staff ? `<button class="tbl-btn" data-delete-student="${s.id}">Delete</button>` : ""}</td>
    </tr>`).join("");
}

const addStudentBtn = document.getElementById("add-student-btn");
if(addStudentBtn){
  addStudentBtn.addEventListener("click", async ()=>{
    const name = prompt("Student's full name?");
    if(!name) return;
    const email = prompt("Student's email?");
    if(!email) return;
    try {
      await api("/students", { method:"POST", body: JSON.stringify({ name, email }) });
      await loadStudents();
      renderStudents(); renderOverview();
      notify("Student added", `“${name}” was registered.`);
    } catch (err) {
      notify("Couldn't add student", err.message);
    }
  });
}

document.getElementById("students-body").addEventListener("click", async (e)=>{
  const btn = e.target.closest("[data-delete-student]");
  if(!btn) return;
  const s = STUDENTS.find(x=>x.id===btn.dataset.deleteStudent);
  if(!s) return;
  if(!confirm(`Delete student “${s.name}”?`)) return;
  try {
    await api(`/students/${s.id}`, { method:"DELETE" });
    await loadStudents();
    renderStudents(); renderOverview();
    notify("Student removed", `“${s.name}” was deleted.`);
  } catch (err) {
    notify("Couldn't delete student", err.message);
  }
});

function renderFines(){
  document.getElementById("fines-body").innerHTML = FINES.map(f=>`
    <tr>
      <td>${f.student}</td><td>${f.book}</td><td>$${f.amount.toFixed(2)}</td><td>${f.reason}</td>
      <td><span class="pill-status ${f.status==='Paid'?'ok':'overdue'}">${f.status}</span></td>
      <td>${f.status==='Unpaid' ? `<button class="tbl-btn" data-payfine="${f.book}">Mark Paid</button>` : "—"}</td>
    </tr>`).join("");
}

document.getElementById("content-scroll").addEventListener("click", (e)=>{
  const payBtn = e.target.closest("[data-payfine]");
  if(payBtn){
    const f = FINES.find(f=>f.book===payBtn.dataset.payfine);
    if(f){ f.status="Paid"; renderFines(); notify("Fine settled", `Payment recorded for “${f.book}”.`); }
  }
  const cancelBtn = e.target.closest("[data-cancel]");
  if(cancelBtn){
    RESERVATIONS = RESERVATIONS.filter(r=>r.book!==cancelBtn.dataset.cancel);
    renderReservations(); notify("Reservation cancelled", "");
  }
  const retBtn = e.target.closest("[data-return]");
  if(retBtn){
    const book = BOOKS.find(b=>b.title===retBtn.dataset.return);
    if(book) book.status = "available";
    TRANSACTIONS = TRANSACTIONS.filter(t=>t.book!==retBtn.dataset.return);
    renderTransactions(); renderBooks(); renderOverview();
    notify("Book returned", `Thanks for returning “${retBtn.dataset.return}”.`);
  }
});

/* ---------------------------------------------------------------------
   11. RENDER: SEATS
--------------------------------------------------------------------- */
let mySeat = null;
function renderSeats(){
  const grid = document.getElementById("seat-grid");
  grid.innerHTML = SEATS.map(s=>`
    <div class="seat ${s.id===mySeat?'mine':s.status==='taken'?'taken':''}" data-seat="${s.id}">${s.id}</div>
  `).join("");
}
document.getElementById("seat-grid").addEventListener("click", (e)=>{
  const cell = e.target.closest(".seat");
  if(!cell) return;
  const id = Number(cell.dataset.seat);
  const seat = SEATS.find(s=>s.id===id);
  if(seat.status==="taken" && id!==mySeat) return;

  if(id === mySeat){
    seat.status = "free"; mySeat = null;
    notify("Seat cancelled", `Seat ${id} released.`);
  } else {
    if(mySeat){ const prev = SEATS.find(s=>s.id===mySeat); prev.status="free"; }
    seat.status = "taken"; mySeat = id;
    notify("Seat reserved", `Seat ${id} is yours until closing.`);
  }
  renderSeats();
});

/* ---------------------------------------------------------------------
   12. SCANNER
--------------------------------------------------------------------- */
document.getElementById("simulate-scan").addEventListener("click", ()=>{
  const b = BOOKS[Math.floor(Math.random()*BOOKS.length)];
  document.getElementById("scan-result").textContent = `Scanned: ${b.title} (${b.isbn}) — ${b.status}`;
});

/* ---------------------------------------------------------------------
   13. REPORTS / CHARTS (lightweight canvas bars)
--------------------------------------------------------------------- */
function drawCharts(){
  drawBarChart("chart-circulation", [12,18,9,22,15,28,20], ["M","T","W","T","F","S","S"], "#3fa9f5");
  const catCounts = CATEGORIES.map(c => BOOKS.filter(b=>b.cat===c).length);
  drawBarChart("chart-category", catCounts, CATEGORIES.map(c=>c.slice(0,3)), "#8b5cf6");
}
function drawBarChart(canvasId, data, labels, color){
  const canvas = document.getElementById(canvasId);
  if(!canvas) return;
  const ctx = canvas.getContext("2d");
  canvas.width = canvas.clientWidth; canvas.height = 180;
  ctx.clearRect(0,0,canvas.width,canvas.height);
  const max = Math.max(...data, 1);
  const bw = canvas.width / data.length;
  data.forEach((v,i)=>{
    const h = (v/max) * (canvas.height - 30);
    const x = i*bw + bw*0.2;
    const grad = ctx.createLinearGradient(0, canvas.height-h, 0, canvas.height);
    grad.addColorStop(0, color);
    grad.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = grad;
    ctx.fillRect(x, canvas.height-h-20, bw*0.6, h);
    ctx.fillStyle = "#8f89ac";
    ctx.font = "10px Rajdhani";
    ctx.textAlign = "center";
    ctx.fillText(labels[i], x + bw*0.3, canvas.height-6);
  });
}

/* ---------------------------------------------------------------------
   14. NOTIFICATIONS DRAWER
--------------------------------------------------------------------- */
const notifDrawer = document.getElementById("notif-drawer");
const aiDrawer = document.getElementById("ai-drawer");
const scrim = document.getElementById("overlay-scrim");

function renderNotifications(){
  document.getElementById("notif-count").textContent = NOTIFICATIONS.length;
  document.getElementById("notif-list").innerHTML = NOTIFICATIONS.map(n=>`
    <li><b>${n.title}</b>${n.body}<time>${n.time}</time></li>`).join("");
}
function notify(title, body){
  NOTIFICATIONS.unshift({title, body, time:"just now"});
  renderNotifications();
  renderOverview();
}

document.getElementById("notif-btn").addEventListener("click", ()=> openDrawer(notifDrawer));
document.getElementById("notif-close").addEventListener("click", ()=> closeDrawers());
document.getElementById("ai-btn").addEventListener("click", ()=> openDrawer(aiDrawer));
document.getElementById("ai-close").addEventListener("click", ()=> closeDrawers());
scrim.addEventListener("click", closeDrawers);

function openDrawer(d){
  closeDrawers();
  d.classList.add("open");
  scrim.classList.add("show");
}
function closeDrawers(){
  notifDrawer.classList.remove("open");
  aiDrawer.classList.remove("open");
  scrim.classList.remove("show");
}

/* ---------------------------------------------------------------------
   15. AI ASSISTANT (Lyra / Link) — mocked Gemini-style responses
--------------------------------------------------------------------- */
const companionBtns = document.querySelectorAll(".companion-btn");
companionBtns.forEach(btn=>{
  btn.addEventListener("click", ()=>{
    companionBtns.forEach(b=>b.classList.remove("active"));
    btn.classList.add("active");
    state.companion = btn.dataset.companion;
    drawAvatar();
    setAiStatus("Idle…");
  });
});

const aiChat = document.getElementById("ai-chat");
const aiForm = document.getElementById("ai-form");
const aiInput = document.getElementById("ai-input");
const aiStatusEl = document.getElementById("ai-status");

function setAiStatus(text){ aiStatusEl.textContent = text; }

function addMsg(role, text){
  const div = document.createElement("div");
  div.className = "msg " + role;
  div.textContent = text;
  aiChat.appendChild(div);
  aiChat.scrollTop = aiChat.scrollHeight;
}

function greetCompanion(){
  const name = state.companion === "lyra" ? "Lyra" : "Link";
  aiChat.innerHTML = "";
  addMsg("bot", `Hi, I'm ${name}. I can help you find books, check due dates, explain fines, or recommend something new. What do you need?`);
}

aiForm.addEventListener("submit",(e)=>{
  e.preventDefault();
  const text = aiInput.value.trim();
  if(!text) return;
  addMsg("user", text);
  aiInput.value = "";
  setAiStatus("Thinking…");
  triggerSpeak();
  setTimeout(()=>{
    addMsg("bot", answerQuery(text));
    setAiStatus("Speaking…");
    setTimeout(()=> setAiStatus("Idle…"), 1400);
  }, 650);
});

function answerQuery(q){
  const lower = q.toLowerCase();

  const catMatch = CATEGORIES.find(c => lower.includes(c.toLowerCase()) || lower.includes(c.split(" ")[0].toLowerCase()));
  if(catMatch || lower.includes("book")){
    const cat = catMatch || null;
    const matches = cat ? BOOKS.filter(b=>b.cat===cat) : BOOKS.filter(b=>b.status==="available");
    if(cat) return `I found ${matches.length} ${cat} book${matches.length===1?"":"s"} in your library. ${matches.slice(0,3).map(b=>b.title).join(", ")}${matches.length>3?", and more.":"."}`;
  }
  if(lower.includes("fine")){
    const total = FINES.filter(f=>f.status==="Unpaid").reduce((a,f)=>a+f.amount,0);
    return `Fines are calculated at $1.00 per day overdue. Right now there's $${total.toFixed(2)} in unpaid fines on record. Would you like the breakdown?`;
  }
  if(lower.includes("due")){
    const t = TRANSACTIONS[0];
    return t ? `“${t.book}” is due on ${t.due}. Return or renew it before then to avoid a fine.` : "You don't have any books currently checked out.";
  }
  if(lower.includes("recommend") || lower.includes("suggest")){
    const pick = BOOKS[Math.floor(Math.random()*BOOKS.length)];
    return `Based on what's popular right now, I'd recommend “${pick.title}” by ${pick.author} — it's in ${pick.status==='available'?'and ready to borrow':'high demand, but you can reserve it'}.`;
  }
  if(lower.includes("seat")){
    const free = SEATS.filter(s=>s.status==="free").length;
    return `There are currently ${free} seats free in the reading hall. Head to Seat Booking to reserve one.`;
  }
  if(lower.includes("hi") || lower.includes("hello") || lower.includes("hey")){
    return "Hey there! Ask me about book availability, fines, due dates, or say “recommend a book” and I'll pick something for you.";
  }
  return "I can help with book searches, availability, fines, due dates, and recommendations — try asking something like “I need AI books” or “what's my fine balance?”";
}

function triggerSpeak(){
  const mouth = document.getElementById("avatar-mouth");
  if(!mouth) return;
  let n = 0;
  const iv = setInterval(()=>{
    mouth.setAttribute("ry", n%2===0 ? "6" : "2.5");
    n++;
    if(n>10){ clearInterval(iv); mouth.setAttribute("ry","3.5"); }
  }, 130);
}

/* ---- animated SVG avatar (idle breathing / blinking / head tracking) ---- */
function drawAvatar(){
  const svg = document.getElementById("ai-avatar-svg");
  const isLyra = state.companion === "lyra";
  const suit = isLyra ? "#3fa9f5" : "#1b1a2a";
  const accent = isLyra ? "#c9c4e0" : "#fb923c";
  const glow = isLyra ? "#7cc6ff" : "#fb923c";
  svg.innerHTML = `
    <defs>
      <radialGradient id="faceGlow" cx="50%" cy="40%" r="60%">
        <stop offset="0%" stop-color="#fff" stop-opacity="0.9"/>
        <stop offset="100%" stop-color="${glow}" stop-opacity="0.15"/>
      </radialGradient>
    </defs>
    <g id="avatar-body" style="transform-origin:100px 160px">
      <ellipse cx="100" cy="175" rx="46" ry="34" fill="${suit}" opacity="0.9"/>
      <circle cx="100" cy="105" r="4" fill="${accent}" opacity=".5"/>
    </g>
    <g id="avatar-head" style="transform-origin:100px 95px">
      <circle cx="100" cy="95" r="42" fill="url(#faceGlow)" />
      <circle cx="100" cy="95" r="42" fill="none" stroke="${glow}" stroke-width="1.2" opacity="0.6"/>
      <ellipse id="eye-l" cx="84" cy="92" rx="5" ry="6" fill="${glow}"/>
      <ellipse id="eye-r" cx="116" cy="92" rx="5" ry="6" fill="${glow}"/>
      <ellipse id="avatar-mouth" cx="100" cy="112" rx="9" ry="3.5" fill="${accent}" opacity="0.8"/>
    </g>
  `;
  animateAvatar();
}

let avatarRAF;
function animateAvatar(){
  cancelAnimationFrame(avatarRAF);
  const head = document.getElementById("avatar-head");
  const body = document.getElementById("avatar-body");
  const eyeL = document.getElementById("eye-l");
  const eyeR = document.getElementById("eye-r");
  let t = 0, blinkTimer = 0;
  function loop(){
    t += 0.02;
    const breathe = Math.sin(t*1.5) * 2;
    body.style.transform = `translateY(${breathe*0.4}px) scale(${1+breathe*0.003})`;
    const track = Math.sin(t*0.5) * 4;
    head.style.transform = `translate(${track}px, ${Math.sin(t*1.5)*1.2}px) rotate(${track*0.15}deg)`;

    blinkTimer += 1;
    if(blinkTimer > 140){
      eyeL.setAttribute("ry","0.6"); eyeR.setAttribute("ry","0.6");
      if(blinkTimer > 148){ blinkTimer = 0; }
    } else {
      eyeL.setAttribute("ry","6"); eyeR.setAttribute("ry","6");
    }
    avatarRAF = requestAnimationFrame(loop);
  }
  loop();
}

/* ---------------------------------------------------------------------
   16. HELPERS
--------------------------------------------------------------------- */
function todayStr(){ return new Date().toISOString().slice(0,10); }
function addDays(n){ const d = new Date(); d.setDate(d.getDate()+n); return d.toISOString().slice(0,10); }

function renderAll(){
  renderOverview();
  renderBooks();
  renderTransactions();
  renderReservations();
  if(document.getElementById("students-body")) renderStudents();
  renderFines();
  renderSeats();
  renderNotifications();
  drawAvatar();
  greetCompanion();
}

})();
