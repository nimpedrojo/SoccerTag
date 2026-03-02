let currentUser = null; // { userId, username, teamName }
let matchId = null;
let running = false;
let startTime = 0;
let elapsed = 0;
let timerInterval = null;

const selections = {};
let teamConfig = { teamName: "", players: [] };
let currentEventTeam = "propio"; // "propio" | "rival"
let pendingEventOption = null;
let currentEventMeta = { playerNumber: "", zone: "" };

function saveUserToStorage() {
  if (currentUser) {
    localStorage.setItem("soccertag_user", JSON.stringify(currentUser));
  } else {
    localStorage.removeItem("soccertag_user");
  }
}

function loadUserFromStorage() {
  const raw = localStorage.getItem("soccertag_user");
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function saveTeamToStorage() {
  if (!currentUser) return;
  const key = `soccertag_team_${currentUser.username}`;
  localStorage.setItem(key, JSON.stringify(teamConfig));
}

function loadTeamFromStorage() {
  if (!currentUser) return;
  const key = `soccertag_team_${currentUser.username}`;
  const raw = localStorage.getItem(key);
  if (!raw) {
    teamConfig = { teamName: currentUser.teamName || "", players: [] };
    return;
  }
  try {
    const parsed = JSON.parse(raw);
    teamConfig = {
      teamName: parsed.teamName || "",
      players: Array.isArray(parsed.players) ? parsed.players : [],
    };
  } catch {
    teamConfig = { teamName: currentUser.teamName || "", players: [] };
  }
}

function updateAuthUI() {
  const mainMenu = document.getElementById("main-menu");
  const welcome = document.getElementById("welcome-label");
  const authBox = document.getElementById("auth-box");
  const ownTeamInput = document.getElementById("home-team");
  const logoutBtn = document.getElementById("btn-logout");
  const userScreen = document.getElementById("user-screen");

  if (currentUser) {
    authBox.classList.add("hidden");
    mainMenu.classList.remove("hidden");
    welcome.textContent = `Hola, ${currentUser.username}`;
    if (currentUser.teamName && ownTeamInput) {
      ownTeamInput.value = currentUser.teamName;
    }
    // Mostrar botón de logout en la barra
    logoutBtn.classList.remove("d-none");
    // Quitar estilo de tarjeta centrada para las opciones
    userScreen.classList.remove("login-panel");
  } else {
    authBox.classList.remove("hidden");
    mainMenu.classList.add("hidden");
    welcome.textContent = "";
    // Ocultar botón de logout de la barra
    logoutBtn.classList.add("d-none");
    // Volver a mostrar el panel de login centrado
    userScreen.classList.add("login-panel");
  }
}

function showMatchScreen() {
  if (!currentUser) return;
  const userScreen = document.getElementById("user-screen");
  const teamScreen = document.getElementById("team-screen");
  const matchesScreen = document.getElementById("matches-screen");
  const matchScreen = document.getElementById("match-screen");
  const homeInput = document.getElementById("home-team");
  homeInput.value = currentUser.teamName || "Equipo propio";
  userScreen.classList.add("hidden");
  teamScreen.classList.add("hidden");
  matchesScreen.classList.add("hidden");
  matchScreen.classList.remove("hidden");
}

function showTeamScreen() {
  if (!currentUser) return;
  const userScreen = document.getElementById("user-screen");
  const teamScreen = document.getElementById("team-screen");
  const matchScreen = document.getElementById("match-screen");
  const matchesScreen = document.getElementById("matches-screen");

  userScreen.classList.add("hidden");
  matchScreen.classList.add("hidden");
  matchesScreen.classList.add("hidden");
  teamScreen.classList.remove("hidden");

  // Rellenar datos existentes de equipo
  loadTeamFromStorage();
  const teamNameInput = document.getElementById("team-name-input");
  const playersContainer = document.getElementById("players-container");
  if (teamNameInput) teamNameInput.value = teamConfig.teamName || "";
  if (playersContainer) {
    playersContainer.innerHTML = "";
    if (teamConfig.players.length === 0) {
      addPlayerRow();
    } else {
      teamConfig.players.forEach((p) => addPlayerRow(p));
    }
  }
}

async function showMatchesScreen() {
  if (!currentUser) return;
  const userScreen = document.getElementById("user-screen");
  const teamScreen = document.getElementById("team-screen");
  const matchScreen = document.getElementById("match-screen");
  const matchesScreen = document.getElementById("matches-screen");

  userScreen.classList.add("hidden");
  teamScreen.classList.add("hidden");
  matchScreen.classList.add("hidden");
  matchesScreen.classList.remove("hidden");

  await loadMatchesList();
}

async function loadMatchesList() {
  const tbody = document.getElementById("matches-table-body");
  const eventsPanel = document.getElementById("match-events-panel");
  const eventsBody = document.getElementById("match-events-body");
  const eventsTitle = document.getElementById("match-events-title");
  if (!tbody) return;
  tbody.innerHTML = "";
  if (eventsPanel && eventsBody && eventsTitle) {
    eventsPanel.classList.add("hidden");
    eventsBody.innerHTML = "";
    eventsTitle.textContent = "";
  }

  const res = await fetch("/api/matches");
  if (!res.ok) return;
  const matches = await res.json();

  matches.forEach((m, index) => {
    const tr = document.createElement("tr");
    const created = new Date(m.createdAt);
    tr.innerHTML = `
      <td>${created.toLocaleString()}</td>
      <td>${m.homeTeam}</td>
      <td>${m.awayTeam}</td>
      <td><code>${m.matchId}</code></td>
      <td>
        <button class="btn btn-sm btn-outline-primary me-1" data-action="view" data-id="${m.matchId}">Ver eventos</button>
        <button class="btn btn-sm btn-outline-success me-1" data-action="export" data-id="${m.matchId}">Export JSON</button>
        <button class="btn btn-sm btn-outline-danger" data-action="delete" data-id="${m.matchId}">Borrar</button>
      </td>
    `;

    tbody.appendChild(tr);
  });

  tbody.querySelectorAll("button[data-action]").forEach((btn) => {
    const action = btn.getAttribute("data-action");
    const id = btn.getAttribute("data-id");
    if (!id) return;
    if (action === "view") {
      btn.addEventListener("click", () => loadMatchEvents(id));
    } else if (action === "export") {
      btn.addEventListener("click", () => exportMatchJson(id));
    } else if (action === "delete") {
      btn.addEventListener("click", () => deleteMatch(id));
    }
  });
}

async function loadMatchEvents(matchId) {
  const eventsPanel = document.getElementById("match-events-panel");
  const eventsBody = document.getElementById("match-events-body");
  const eventsTitle = document.getElementById("match-events-title");
  if (!eventsPanel || !eventsBody || !eventsTitle) return;

  const res = await fetch(`/api/matches/${encodeURIComponent(matchId)}/export`);
  if (!res.ok) return;
  const data = await res.json();

  eventsTitle.textContent = `${data.meta.teams.home} vs ${data.meta.teams.away} (${data.meta.matchId})`;
  eventsBody.innerHTML = "";

  data.events.forEach((evt, idx) => {
    const sel = evt.selections || {};
    const evento = (sel.evento && sel.evento[0]) || "";
    const equipo = (sel.equipo && sel.equipo[0]) || "";
    const jugador = (sel.jugador && sel.jugador[0]) || "";
    const zona = (sel.zona && sel.zona[0]) || "";
    const mm = Math.floor(evt.tMatchMs / 60000);
    const ss = String(Math.floor((evt.tMatchMs % 60000) / 1000)).padStart(2, "0");
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${idx + 1}</td>
      <td>${evt.period}</td>
      <td>${mm}:${ss}</td>
      <td>${evento}</td>
      <td>${equipo}</td>
      <td>${jugador}</td>
      <td>${zona}</td>
    `;
    eventsBody.appendChild(tr);
  });

  eventsPanel.classList.remove("hidden");
}

async function deleteMatch(matchId) {
  if (!confirm("¿Seguro que quieres borrar este partido y todos sus eventos?")) {
    return;
  }
  const res = await fetch(`/api/matches/${encodeURIComponent(matchId)}`, {
    method: "DELETE",
  });
  if (!res.ok) return;
  await loadMatchesList();
}

async function exportMatchJson(matchId) {
  const res = await fetch(`/api/matches/${encodeURIComponent(matchId)}/export`);
  if (!res.ok) return;
  const bundle = await res.json();
  const dataStr = JSON.stringify(bundle, null, 2);
  const blob = new Blob([dataStr], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${bundle.meta.matchId}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function addPlayerRow(player) {
  const playersContainer = document.getElementById("players-container");
  if (!playersContainer) return;
  const row = document.createElement("div");
  row.className = "player-row";

  const nameInput = document.createElement("input");
  nameInput.type = "text";
  nameInput.placeholder = "Nombre";
  nameInput.value = player?.name || "";

  const numberInput = document.createElement("input");
  numberInput.type = "number";
  numberInput.placeholder = "Dorsal";
  numberInput.value = player?.number || "";

  const positionInput = document.createElement("input");
  positionInput.type = "text";
  positionInput.placeholder = "Posición";
  positionInput.value = player?.position || "";

  const removeBtn = document.createElement("button");
  removeBtn.type = "button";
  removeBtn.className = "btn btn-sm btn-outline-danger";
  removeBtn.textContent = "X";
  removeBtn.addEventListener("click", () => {
    playersContainer.removeChild(row);
  });

  row.appendChild(nameInput);
  row.appendChild(numberInput);
  row.appendChild(positionInput);
  row.appendChild(removeBtn);
  playersContainer.appendChild(row);
}

function updateTimerDisplay() {
  const total = elapsed + (running ? Date.now() - startTime : 0);
  const mm = Math.floor(total / 60000);
  const ss = String(Math.floor((total % 60000) / 1000)).padStart(2, "0");
  document.getElementById("timer-display").textContent = `${mm}:${ss}`;
}

function startTimer() {
  if (running) return;
  running = true;
  startTime = Date.now();
  if (timerInterval) clearInterval(timerInterval);
  timerInterval = setInterval(updateTimerDisplay, 500);
}

function pauseTimer() {
  if (!running) return;
  running = false;
  elapsed += Date.now() - startTime;
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
  updateTimerDisplay();
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

  // Iniciar cronómetro automáticamente al iniciar partido
  startTimer();
  const startBtn = document.getElementById("start-match");
  if (startBtn) startBtn.textContent = "Pausar partido";
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

  const startBtn = document.getElementById("start-match");
  if (startBtn) startBtn.textContent = "Iniciar partido";
}

async function registerEvent() {
  if (!matchId) {
    alert("Debes iniciar el partido antes de registrar eventos.");
    return;
  }
  const total = elapsed + (running ? Date.now() - startTime : 0);
  const baseSelections = selectionsToObject ? selectionsToObject() : {};
  if (currentEventMeta.playerNumber) {
    baseSelections.jugador = [currentEventMeta.playerNumber];
  }
  if (currentEventMeta.zone) {
    baseSelections.zona = [String(currentEventMeta.zone)];
  }
  const payload = {
    matchId,
    period: "1T",
    tMatchMs: total,
    selections: {
      ...baseSelections,
      equipo: [currentEventTeam === "propio" ? "Equipo propio" : "Equipo rival"],
    },
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
  // Auth initial state
  currentUser = loadUserFromStorage();
  updateAuthUI();

  document.getElementById("btn-login").addEventListener("click", async () => {
    const username = document.getElementById("username").value.trim();
    const password = document.getElementById("password").value;
    const errorEl = document.getElementById("auth-error");
    errorEl.classList.add("hidden");
    errorEl.textContent = "";

    if (!username || !password) {
      errorEl.textContent = "Usuario y password son obligatorios";
      errorEl.classList.remove("hidden");
      return;
    }

    const res = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    if (!res.ok) {
      errorEl.textContent = "Credenciales inválidas";
      errorEl.classList.remove("hidden");
      return;
    }
    const data = await res.json();
    currentUser = data;
    saveUserToStorage();
    loadTeamFromStorage();
    updateAuthUI();
  });

  document
    .getElementById("btn-register")
    .addEventListener("click", async () => {
      const username = document.getElementById("username").value.trim();
      const password = document.getElementById("password").value;
      const errorEl = document.getElementById("auth-error");
      errorEl.classList.add("hidden");
      errorEl.textContent = "";

      if (!username || !password) {
        errorEl.textContent = "Usuario y password son obligatorios";
        errorEl.classList.remove("hidden");
        return;
      }

      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        errorEl.textContent =
          body.error || "No se pudo registrar el usuario";
        errorEl.classList.remove("hidden");
        return;
      }
      const data = await res.json();
      currentUser = data;
      saveUserToStorage();
      loadTeamFromStorage();
      updateAuthUI();
    });

  document
    .getElementById("btn-config-team")
    .addEventListener("click", () => {
      showTeamScreen();
    });

  document
    .getElementById("btn-view-matches")
    .addEventListener("click", () => {
      showMatchesScreen();
    });

  document
    .getElementById("btn-start-record")
    .addEventListener("click", () => {
      showMatchScreen();
    });

  // Volver al inicio (pantalla principal) al pulsar en el nombre
  document.getElementById("app-brand").addEventListener("click", () => {
    const userScreen = document.getElementById("user-screen");
    const teamScreen = document.getElementById("team-screen");
    const matchesScreen = document.getElementById("matches-screen");
    const matchScreen = document.getElementById("match-screen");
    userScreen.classList.remove("hidden");
    teamScreen.classList.add("hidden");
    matchesScreen.classList.add("hidden");
    matchScreen.classList.add("hidden");
    updateAuthUI();
  });

  document
    .getElementById("btn-add-player")
    .addEventListener("click", () => addPlayerRow());

  document
    .getElementById("btn-team-back")
    .addEventListener("click", () => {
      const teamScreen = document.getElementById("team-screen");
      const userScreen = document.getElementById("user-screen");
      teamScreen.classList.add("hidden");
      userScreen.classList.remove("hidden");
      updateAuthUI();
    });

  document
    .getElementById("btn-save-team-full")
    .addEventListener("click", async () => {
      if (!currentUser) return;
      const teamNameInput = document.getElementById("team-name-input");
      const playersContainer = document.getElementById("players-container");
      const msgEl = document.getElementById("team-message");
      const teamName = teamNameInput.value.trim();
      if (!teamName) {
        msgEl.textContent = "El nombre del equipo es obligatorio";
        return;
      }

      const players = [];
      playersContainer.querySelectorAll(".player-row").forEach((row) => {
        const [nameInput, numberInput, positionInput] =
          row.querySelectorAll("input");
        const name = nameInput.value.trim();
        const number = numberInput.value.trim();
        const position = positionInput.value.trim();
        if (name || number || position) {
          players.push({ name, number, position });
        }
      });

      teamConfig = { teamName, players };
      saveTeamToStorage();

      // Actualizar solo el nombre del equipo en backend
      await fetch("/api/user/team", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: currentUser.userId, teamName }),
      });
      currentUser.teamName = teamName;
      saveUserToStorage();
      msgEl.textContent = "Equipo guardado";
      setTimeout(() => {
        msgEl.textContent = "";
      }, 1500);
    });

  document.getElementById("btn-logout").addEventListener("click", () => {
    // Limpiar usuario y volver a pantalla de acceso
    currentUser = null;
    saveUserToStorage();
    const userScreen = document.getElementById("user-screen");
    const matchScreen = document.getElementById("match-screen");
    userScreen.classList.remove("hidden");
    matchScreen.classList.add("hidden");
    // Reset partido actual
    matchId = null;
    elapsed = 0;
    running = false;
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
    updateTimerDisplay();
    updateAuthUI();
  });

  document
    .getElementById("start-match")
    .addEventListener("click", async () => {
      const startBtn = document.getElementById("start-match");
      // Si no hay partido aún, lo creamos y empezamos a contar
      if (!matchId) {
        await startMatch();
        return;
      }
      // Si ya hay partido, este botón actúa como Pausar/Reanudar
      if (running) {
        pauseTimer();
        if (startBtn) startBtn.textContent = "Reanudar partido";
      } else {
        startTimer();
        if (startBtn) startBtn.textContent = "Pausar partido";
      }
    });
  document
    .getElementById("end-match")
    .addEventListener("click", () => endMatch());

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

  // Clicks en botones de evento: si no es "Cambio", abrir modal de detalle
  document.querySelectorAll(".tag-button").forEach((btn) => {
    const category = btn.getAttribute("data-category");
    const option = btn.getAttribute("data-option");
    if (category === "evento" && option !== "Cambio") {
      btn.addEventListener("click", () => {
        pendingEventOption = option;
        currentEventMeta = { playerNumber: "", zone: "" };
        const modal = document.getElementById("event-modal");
        const title = document.getElementById("event-modal-title");
        const playerInput = document.getElementById("event-player-number");
        title.textContent = `Detalle de evento: ${option}`;
        playerInput.value = "";
        // limpiar selección de zona
        document.querySelectorAll(".field-cell").forEach((cell) => {
          cell.classList.remove("active");
        });
        modal.classList.remove("hidden");
      });
    } else {
      // Otros botones (incluido "Cambio") se comportan como toggle normal
      btn.addEventListener("click", () => {
        toggleSelection(category, option);
        btn.classList.toggle("active");
      });
    }
  });

  // Toggle equipo propio / rival para los eventos
  const ownBtn = document.getElementById("btn-event-own");
  const rivalBtn = document.getElementById("btn-event-rival");
  if (ownBtn && rivalBtn) {
    ownBtn.addEventListener("click", () => {
      currentEventTeam = "propio";
      ownBtn.classList.add("active");
      rivalBtn.classList.remove("active");
    });
    rivalBtn.addEventListener("click", () => {
      currentEventTeam = "rival";
      rivalBtn.classList.add("active");
      ownBtn.classList.remove("active");
    });
  }

  // Selección de zona del campo en el modal
  document.querySelectorAll(".field-cell").forEach((cell) => {
    cell.addEventListener("click", () => {
      document.querySelectorAll(".field-cell").forEach((c) => c.classList.remove("active"));
      cell.classList.add("active");
      currentEventMeta.zone = cell.getAttribute("data-zone") || "";
    });
  });

  // Acciones del modal de evento
  const modal = document.getElementById("event-modal");
  const modalCancel = document.getElementById("event-modal-cancel");
  const modalOk = document.getElementById("event-modal-ok");

  modalCancel.addEventListener("click", () => {
    modal.classList.add("hidden");
    pendingEventOption = null;
    currentEventMeta = { playerNumber: "", zone: "" };
  });

  modalOk.addEventListener("click", () => {
    if (!pendingEventOption) {
      modal.classList.add("hidden");
      return;
    }
    const playerInput = document.getElementById("event-player-number");
    currentEventMeta.playerNumber = playerInput.value.trim();

    // Actualizar selección de evento (solo uno activo a la vez)
    const category = "evento";
    // Reiniciar set de selections para evento
    selections[category] = new Set();
    selections[category].add(pendingEventOption);

    // Actualizar clases activas de botones de evento
    document
      .querySelectorAll('.tag-button[data-category="evento"]')
      .forEach((btn) => {
        const option = btn.getAttribute("data-option");
        if (option === pendingEventOption) {
          btn.classList.add("active");
        } else {
          btn.classList.remove("active");
        }
      });

    modal.classList.add("hidden");
  });

  updateTimerDisplay();
});
