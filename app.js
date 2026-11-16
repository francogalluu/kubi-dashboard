const SUPABASE_URL = "https://edexcofhkiimbbricsys.supabase.co";
const SUPABASE_KEY = "sb_publishable_0Wqh4k_zDeQoUiLsCAR4NQ_fcoBrEmo";

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const loginScreen = document.getElementById("login-screen");
const recoveryScreen = document.getElementById("recovery-screen");
const appScreen = document.getElementById("app");
const loginForm = document.getElementById("login-form");
const loginError = document.getElementById("login-error");
const loginButton = document.getElementById("login-button");
const forgotButton = document.getElementById("forgot-button");
const recoveryForm = document.getElementById("recovery-form");
const recoveryError = document.getElementById("recovery-error");
const recoveryButton = document.getElementById("recovery-button");
const logoutButton = document.getElementById("logout-button");
const tabs = document.querySelectorAll("nav.tabs button");
const panels = {
  notes: document.getElementById("panel-notes"),
  tasks: document.getElementById("panel-tasks"),
  expenses: document.getElementById("panel-expenses"),
  checkins: document.getElementById("panel-checkins"),
};

let loaded = { notes: false, tasks: false, expenses: false, checkins: false };

const EXPENSE_LABELS = {
  food: "Comida", transport: "Transporte", entertainment: "Entretenimiento",
  health: "Salud", home: "Hogar", clothing: "Ropa", utilities: "Servicios",
  education: "Educación", groceries: "Almacén", other: "Otro",
};


function fmtMoney(amount, currency) {
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: currency || "ARS", maximumFractionDigits: 0 }).format(amount);
}

function fmtDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "2-digit" });
}

function fmtDue(iso, precision) {
  if (!iso) return "";
  const d = new Date(iso);
  const date = d.toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "2-digit" });
  if (precision !== "time") return date;
  return `${date} ${d.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}`;
}

function esc(s) {
  return (s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

async function showApp() {
  loginScreen.classList.add("hidden");
  recoveryScreen.classList.add("hidden");
  appScreen.classList.remove("hidden");
  await loadTab("notes");
}

function showLogin(message) {
  appScreen.classList.add("hidden");
  recoveryScreen.classList.add("hidden");
  loginScreen.classList.remove("hidden");
  loginError.textContent = message || "";
}

function showRecovery() {
  loginScreen.classList.add("hidden");
  appScreen.classList.add("hidden");
  recoveryScreen.classList.remove("hidden");
}

loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  loginButton.disabled = true;
  loginError.textContent = "";
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  loginButton.disabled = false;
  if (error) {
    loginError.textContent = "No pudimos iniciar sesión. Revisá el email y la contraseña.";
    return;
  }
  loaded = { notes: false, tasks: false, checkins: false };
  showApp();
});

forgotButton.addEventListener("click", async () => {
  const email = document.getElementById("email").value.trim();
  if (!email) {
    loginError.textContent = "Escribí tu email arriba primero.";
    return;
  }
  loginError.textContent = "";
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: window.location.origin + window.location.pathname,
  });
  loginError.textContent = error
    ? "No pudimos enviar el mail. Probá de nuevo en un rato."
    : "Listo, revisá tu mail para elegir una contraseña nueva.";
});

recoveryForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  recoveryButton.disabled = true;
  recoveryError.textContent = "";
  const password = document.getElementById("new-password").value;
  const { error } = await supabase.auth.updateUser({ password });
  recoveryButton.disabled = false;
  if (error) {
    recoveryError.textContent = "No se pudo guardar. Probá con otra contraseña.";
    return;
  }
  showApp();
});

logoutButton.addEventListener("click", async () => {
  await supabase.auth.signOut();
  showLogin();
});

tabs.forEach((btn) => {
  btn.addEventListener("click", () => {
    tabs.forEach((b) => b.classList.toggle("active", b === btn));
    Object.entries(panels).forEach(([name, el]) => el.classList.toggle("hidden", name !== btn.dataset.tab));
    loadTab(btn.dataset.tab);
  });
});

async function loadTab(name) {
  if (loaded[name]) return;
  loaded[name] = true;
  if (name === "notes") return renderNotes();
  if (name === "tasks") return renderTasks();
  if (name === "expenses") return renderExpenses();
  if (name === "checkins") return renderCheckins();
}

async function renderExpenses() {
  panels.expenses.innerHTML = '<div class="loading">Cargando gastos...</div>';
  const { data, error } = await supabase
    .from("expenses")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(400);
  if (error) return (panels.expenses.innerHTML = `<div class="empty">Error: ${esc(error.message)}</div>`);
  if (!data.length) return (panels.expenses.innerHTML = '<div class="empty">Todavía no hay gastos guardados.</div>');

  const now = new Date();
  const thisMonth = data.filter((e) => {
    const d = new Date(e.created_at);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
  const monthTotal = thisMonth.reduce((sum, e) => sum + Number(e.amount), 0);

  const summary = `
    <div class="card">
      <div class="row">
        <h3>Este mes</h3>
        <span class="date">${thisMonth.length} gasto${thisMonth.length === 1 ? "" : "s"}</span>
      </div>
      <p class="summary" style="font-size:22px;font-weight:700;color:var(--text);margin-top:8px">
        ${fmtMoney(monthTotal, "ARS")}
      </p>
    </div>`;

  // Scoped to this month, same as the total above -- "where did it go"
  // only makes sense against the total it's a slice of.
  panels.expenses.innerHTML = summary + categoryBreakdown(thisMonth, monthTotal) + dayGroups(data);
}

function categoryBreakdown(expenses, total) {
  if (!total) return "";
  const byCategory = new Map();
  for (const e of expenses) {
    const key = e.category || "other";
    byCategory.set(key, (byCategory.get(key) || 0) + Number(e.amount));
  }
  const rows = [...byCategory.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([cat, amount]) => {
      const pct = Math.round((amount / total) * 100);
      return `
        <div class="cat-row">
          <div class="cat-row-top">
            <span class="cat-name">${esc(EXPENSE_LABELS[cat] || cat)}</span>
            <span class="cat-amount">${fmtMoney(amount, "ARS")} · ${pct}%</span>
          </div>
          <div class="cat-bar"><div class="cat-bar-fill" style="width:${pct}%"></div></div>
        </div>`;
    })
    .join("");
  return `<div class="card"><h3 class="card-title">Por categoría</h3>${rows}</div>`;
}

// Local calendar day, not a UTC one -- "hoy"/"ayer" has to match the day the
// person actually experienced, same reasoning as the firmware's own
// day-boundary math for reminders.
function dayKey(iso) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function dayLabel(iso) {
  const d = new Date(iso);
  const startOf = (dt) => new Date(dt.getFullYear(), dt.getMonth(), dt.getDate()).getTime();
  const diffDays = Math.round((startOf(new Date()) - startOf(d)) / 86400000);
  if (diffDays === 0) return "Hoy";
  if (diffDays === 1) return "Ayer";
  return d.toLocaleDateString("es-AR", { weekday: "long", day: "2-digit", month: "short" });
}

function dayGroups(expenses) {
  // `expenses` is already newest-first, so grouping sequentially (a Map,
  // not a sort) keeps that same order across groups for free.
  const groups = new Map();
  for (const e of expenses) {
    const key = dayKey(e.created_at);
    if (!groups.has(key)) groups.set(key, { label: dayLabel(e.created_at), items: [], total: 0 });
    const g = groups.get(key);
    g.items.push(e);
    g.total += Number(e.amount);
  }
  return [...groups.values()]
    .map(
      (g) => `
        <div class="day-group">
          <div class="day-head">
            <span class="day-label">${esc(g.label)}</span>
            <span class="day-total">${fmtMoney(g.total, "ARS")}</span>
          </div>
          <div class="card day-card">
            ${g.items
              .map(
                (e) => `
                  <div class="expense-row">
                    <div class="expense-row-text">
                      <span class="expense-desc">${esc(e.description || EXPENSE_LABELS[e.category] || "Gasto")}</span>
                      <span class="badge">${esc(EXPENSE_LABELS[e.category] || e.category)}</span>
                    </div>
                    <span class="expense-amount">${fmtMoney(e.amount, e.currency)}</span>
                  </div>`
              )
              .join("")}
          </div>
        </div>`
    )
    .join("");
}

const NOTE_KIND_LABELS = {
  thought: "Pensamientos", idea: "Ideas", task: "Tareas", event: "Eventos",
  decision: "Decisiones", question: "Preguntas", reference: "Referencias", expense: "Gastos",
};

function noteCard(n) {
  const tags = [...(n.topics || []), ...(n.people || []), ...(n.projects || [])]
    .map((t) => `<span class="tag">${esc(t)}</span>`)
    .join("");
  return `
    <div class="card">
      <div class="row">
        <h3>${esc(n.title || "(sin título)")}</h3>
        <span class="date">${fmtDate(n.created_at)}</span>
      </div>
      <p class="summary">${esc(n.summary || n.transcript || "")}</p>
      <span class="badge">${esc(n.kind || "nota")}</span>
      ${n.mood ? `<span class="badge">${esc(n.mood)}</span>` : ""}
      ${tags ? `<div class="tags">${tags}</div>` : ""}
    </div>`;
}

async function renderNotes() {
  panels.notes.innerHTML = '<div class="loading">Cargando notas...</div>';
  const { data, error } = await supabase
    .from("notes")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) return (panels.notes.innerHTML = `<div class="empty">Error: ${esc(error.message)}</div>`);
  if (!data.length) return (panels.notes.innerHTML = '<div class="empty">Todavía no hay notas guardadas.</div>');

  const kinds = [...new Set(data.map((n) => n.kind).filter(Boolean))];
  const chips = ["all", ...kinds]
    .map(
      (k) =>
        `<button class="chip${k === "all" ? " active" : ""}" data-kind="${esc(k)}">${
          k === "all" ? "Todas" : esc(NOTE_KIND_LABELS[k] || k)
        }</button>`
    )
    .join("");

  panels.notes.innerHTML = `<div class="chip-row">${chips}</div><div id="notes-list"></div>`;
  const list = document.getElementById("notes-list");
  list.innerHTML = data.map(noteCard).join("");

  panels.notes.querySelectorAll(".chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      panels.notes.querySelectorAll(".chip").forEach((c) => c.classList.toggle("active", c === chip));
      const kind = chip.dataset.kind;
      const filtered = kind === "all" ? data : data.filter((n) => n.kind === kind);
      list.innerHTML = filtered.length
        ? filtered.map(noteCard).join("")
        : '<div class="empty">No hay notas en esta categoría.</div>';
    });
  });
}

async function renderTasks() {
  panels.tasks.innerHTML = '<div class="loading">Cargando tareas...</div>';
  const { data, error } = await supabase
    .from("tasks")
    .select("*")
    .order("done", { ascending: true })
    .order("due_at", { ascending: true, nullsFirst: false })
    .limit(400);
  if (error) return (panels.tasks.innerHTML = `<div class="empty">Error: ${esc(error.message)}</div>`);
  if (!data.length) return (panels.tasks.innerHTML = '<div class="empty">No hay tareas guardadas.</div>');

  panels.tasks.innerHTML = data
    .map(
      (t) => `
        <div class="card task-row ${t.done ? "done" : ""}">
          <div class="dot"></div>
          <div style="flex:1">
            <h3>${esc(t.title)}</h3>
            <span class="date">${esc(t.type || "todo")}${t.due_at ? " · " + fmtDue(t.due_at, t.due_precision) : ""}</span>
          </div>
        </div>`
    )
    .join("");
}

async function renderCheckins() {
  panels.checkins.innerHTML = '<div class="loading">Cargando check-ins...</div>';
  const { data, error } = await supabase
    .from("checkins")
    .select("*")
    .order("local_date", { ascending: false })
    .limit(200);
  if (error) return (panels.checkins.innerHTML = `<div class="empty">Error: ${esc(error.message)}</div>`);
  if (!data.length) return (panels.checkins.innerHTML = '<div class="empty">Todavía no hay check-ins.</div>');

  panels.checkins.innerHTML = data
    .map((c) => {
      const emotions = (c.emotions || []).map((e) => `<span class="tag">${esc(e)}</span>`).join("");
      return `
        <div class="card">
          <div class="row">
            <h3>${fmtDate(c.local_date)}</h3>
          </div>
          <div class="scores">
            <span class="score">Ánimo<br><b>${c.sentiment_score ?? "-"}</b></span>
            <span class="score">Energía<br><b>${c.energy_score ?? "-"}/10</b></span>
          </div>
          ${c.highlight ? `<p class="summary"><b>Lo mejor:</b> ${esc(c.highlight)}</p>` : ""}
          ${c.concern ? `<p class="summary"><b>Preocupación:</b> ${esc(c.concern)}</p>` : ""}
          ${c.gratitude ? `<p class="summary"><b>Gratitud:</b> ${esc(c.gratitude)}</p>` : ""}
          ${emotions ? `<div class="tags">${emotions}</div>` : ""}
        </div>`;
    })
    .join("");
}

(async function init() {
  let inRecovery = false;

  supabase.auth.onAuthStateChange((event, session) => {
    if (event === "PASSWORD_RECOVERY") {
      inRecovery = true;
      showRecovery();
    } else if (!session && !inRecovery) {
      showLogin();
    }
  });

  const { data } = await supabase.auth.getSession();
  if (!inRecovery) {
    if (data.session) showApp();
    else showLogin();
  }

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }
})();
