const SUPABASE_URL = "https://edexcofhkiimbbricsys.supabase.co";
const SUPABASE_KEY = "sb_publishable_0Wqh4k_zDeQoUiLsCAR4NQ_fcoBrEmo";

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const loginScreen = document.getElementById("login-screen");
const appScreen = document.getElementById("app");
const loginForm = document.getElementById("login-form");
const loginError = document.getElementById("login-error");
const loginButton = document.getElementById("login-button");
const logoutButton = document.getElementById("logout-button");
const tabs = document.querySelectorAll("nav.tabs button");
const panels = {
  notes: document.getElementById("panel-notes"),
  tasks: document.getElementById("panel-tasks"),
  checkins: document.getElementById("panel-checkins"),
};

let loaded = { notes: false, tasks: false, checkins: false };

function fmtDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "2-digit" });
}

function esc(s) {
  return (s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

async function showApp() {
  loginScreen.classList.add("hidden");
  appScreen.classList.remove("hidden");
  await loadTab("notes");
}

function showLogin(message) {
  appScreen.classList.add("hidden");
  loginScreen.classList.remove("hidden");
  loginError.textContent = message || "";
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
  if (name === "checkins") return renderCheckins();
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

  panels.notes.innerHTML = data
    .map((n) => {
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
    })
    .join("");
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
            <span class="date">${esc(t.type || "todo")}${t.due_at ? " · " + fmtDate(t.due_at) : ""}</span>
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
  const { data } = await supabase.auth.getSession();
  if (data.session) showApp();
  else showLogin();

  supabase.auth.onAuthStateChange((_event, session) => {
    if (!session) showLogin();
  });

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }
})();
