let matchId = null;
let running = false;
let startTime = 0;
let elapsed = 0;
let timerInterval = null;

const selections = {};

function updateTimerDisplay() {
  const total = elapsed + (running ? Date.now() - startTime : 0);
  const mm = Math.floor(total / 60000);
  const ss = String(Math.floor((total % 60000) / 1000)).padStart(2, "0");
  document.getElementById("timer-display").textContent = `${mm}:${ss}`;
}

function toggleSelection(category, option) {
  if (!selections[category]) selections[category] = new Set();
  if (selections[category].has(option)) {
    selections[category].delete(option);
  } else {
    selections[category].add(option);
  }
}

function selectionsToObject() {
  const obj = {};
  for (const [cat, set] of Object.entries(selections)) {
    obj[cat] = Array.from(set);
  }
  return obj;
}

async function startMatch() {
  const home = document.getElementById("home-team").value || "Local";
  const away = document.getElementById("away-team").value || "Visitante";
  const res = await fetch("/api/matches", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ home, away }),
  });
  const data = await res.json();
  matchId = data.matchId;
  document.getElementById(
    "teams-label"
  ).textContent = `${home} vs ${away} (id: ${matchId})`;
  document.getElementById("match-setup").classList.add("hidden");
  document.getElementById("match-meta").classList.remove("hidden");
}

function endMatch() {
  matchId = null;
  elapsed = 0;
  running = false;
  clearInterval(timerInterval);
  timerInterval = null;
  updateTimerDisplay();
  document.getElementById("match-meta").classList.add("hidden");
  document.getElementById("match-setup").classList.remove("hidden");
}

async function registerEvent() {
  if (!matchId) return;
  const total = elapsed + (running ? Date.now() - startTime : 0);
  const payload = {
    matchId,
    period: "1T",
    tMatchMs: total,
    selections: selectionsToObject(),
  };
  await fetch("/api/events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

async function undoLast() {
  if (!matchId) return;
  await fetch(`/api/events/last?matchId=${encodeURIComponent(matchId)}`, {
    method: "DELETE",
  });
}

async function exportMatch() {
  const id = document.getElementById("export-match-id").value.trim();
  if (!id) return;
  const res = await fetch(`/api/matches/${encodeURIComponent(id)}/export`);
  const data = await res.json();
  document.getElementById("export-output").textContent = JSON.stringify(
    data,
    null,
    2
  );
}

window.addEventListener("DOMContentLoaded", () => {
  document
    .getElementById("start-match")
    .addEventListener("click", () => startMatch());
  document
    .getElementById("end-match")
    .addEventListener("click", () => endMatch());

  document.getElementById("timer-toggle").addEventListener("click", () => {
    if (!running) {
      running = true;
      startTime = Date.now();
      timerInterval = setInterval(updateTimerDisplay, 500);
      document.getElementById("timer-toggle").textContent = "Pausar";
    } else {
      running = false;
      elapsed += Date.now() - startTime;
      clearInterval(timerInterval);
      timerInterval = null;
      updateTimerDisplay();
      document.getElementById("timer-toggle").textContent = "Iniciar";
    }
  });

  document.getElementById("timer-reset").addEventListener("click", () => {
    elapsed = 0;
    if (running) {
      startTime = Date.now();
    }
    updateTimerDisplay();
  });

  document
    .getElementById("register-event")
    .addEventListener("click", () => registerEvent());
  document
    .getElementById("undo-event")
    .addEventListener("click", () => undoLast());
  document
    .getElementById("export-json")
    .addEventListener("click", () => exportMatch());

  document.querySelectorAll(".tag-button").forEach((btn) => {
    btn.addEventListener("click", () => {
      const category = btn.getAttribute("data-category");
      const option = btn.getAttribute("data-option");
      toggleSelection(category, option);
      btn.classList.toggle("active");
    });
  });

  updateTimerDisplay();
});

