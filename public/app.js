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
let lineupState = { onField: [], bench: [] };
let recentEvents = [];
let matchScore = { home: 0, away: 0 };

const zoneMarkerPositions = {
  "1": { x: 12.5, y: 16.5 },
  "2": { x: 12.5, y: 50 },
  "3": { x: 12.5, y: 83.5 },
  "4": { x: 37.5, y: 16.5 },
  "5": { x: 37.5, y: 50 },
  "6": { x: 37.5, y: 83.5 },
  "7": { x: 62.5, y: 16.5 },
  "8": { x: 62.5, y: 50 },
  "9": { x: 62.5, y: 83.5 },
  "10": { x: 87.5, y: 16.5 },
  "11": { x: 87.5, y: 50 },
  "12": { x: 87.5, y: 83.5 },
};

function getCurrentPeriod() {
  const sel = document.getElementById("period-select");
  if (!sel) return "1T";
  return sel.value || "1T";
}

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
    teamConfig = currentUser.teamConfig || {
      teamName: currentUser.teamName || "",
      players: [],
    };
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

  const starterCheckbox = document.createElement("input");
  starterCheckbox.type = "checkbox";
  starterCheckbox.title = "Titular";
  starterCheckbox.checked = Boolean(player?.isStarter);

  const starterLabel = document.createElement("label");
  starterLabel.className = "starter-toggle";
  starterLabel.appendChild(starterCheckbox);
  starterLabel.appendChild(document.createTextNode("Titular"));

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
  row.appendChild(starterLabel);
  row.appendChild(removeBtn);
  playersContainer.appendChild(row);
}

function updateTimerDisplay() {
  const total = elapsed + (running ? Date.now() - startTime : 0);
  const mm = Math.floor(total / 60000);
  const ss = String(Math.floor((total % 60000) / 1000)).padStart(2, "0");
  document.getElementById("timer-display").textContent = `${mm}:${ss}`;
}

function updatePlaysAsIndicator() {
  const indicator = document.getElementById("plays-as-indicator");
  const playsAsSelect = document.getElementById("plays-as-select");
  if (!indicator || !playsAsSelect) return;
  indicator.textContent =
    playsAsSelect.value === "away"
      ? "Equipo propio: Visitante"
      : "Equipo propio: Local";
}

function formatMatchTime(tMatchMs) {
  const minutes = Math.floor(tMatchMs / 60000);
  const seconds = String(Math.floor((tMatchMs % 60000) / 1000)).padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function toEventSummary(evt) {
  const sel = evt.selections || {};
  const eventName = sel.evento?.[0] || "Evento";
  const teamName = sel.equipo?.[0] || "";
  const playerNumber = sel.jugador?.[0] || sel.cambio_out?.[0] || "";
  const zone = sel.zona?.[0] || "";
  const modifier = Array.isArray(sel.modificador) ? sel.modificador[0] : "";
  const detailParts = [];
  if (playerNumber) detailParts.push(`#${playerNumber}`);
  if (sel.cambio_in?.[0]) detailParts.push(`-> #${sel.cambio_in[0]}`);
  if (zone) detailParts.push(`Zona ${zone}`);
  if (modifier) detailParts.push(modifier);
  return {
    title: `${eventName}${teamName ? ` · ${teamName}` : ""}`,
    detail: detailParts.join(" · ") || "Sin detalle",
    time: formatMatchTime(evt.tMatchMs || 0),
  };
}

async function syncRecentEvents() {
  if (!matchId) {
    recentEvents = [];
    matchScore = { home: 0, away: 0 };
    renderRecentEvents();
    updateScoreboard();
    return;
  }
  const res = await fetch(`/api/matches/${encodeURIComponent(matchId)}/export`);
  if (!res.ok) return;
  const data = await res.json();
  recentEvents = (data.events || []).slice().reverse().slice(0, 8).map(toEventSummary);
  const metaScore = data.meta?.score || {};
  matchScore = {
    home: Number(metaScore.home ?? 0),
    away: Number(metaScore.away ?? 0),
  };
  renderRecentEvents();
  updateScoreboard();
}

function resetEventComposer() {
  pendingEventOption = null;
  currentEventMeta = { playerNumber: "", zone: "" };
  selections.modificador = new Set();
  const playerInput = document.getElementById("event-player-number");
  if (playerInput) playerInput.value = "";
  document.querySelectorAll(".tag-button, .modifier-chip, .pitch-zone, .number-cell").forEach((el) => {
    el.classList.remove("active");
  });
  const marker = document.getElementById("pitch-marker");
  if (marker) marker.classList.add("hidden");
}

function setEventTeamSelection(team) {
  currentEventTeam = team;
  const ownBtn = document.getElementById("btn-event-own");
  const rivalBtn = document.getElementById("btn-event-rival");
  if (!ownBtn || !rivalBtn) return;
  ownBtn.classList.toggle("active", team === "propio");
  rivalBtn.classList.toggle("active", team === "rival");
  ownBtn.setAttribute("aria-pressed", String(team === "propio"));
  rivalBtn.setAttribute("aria-pressed", String(team === "rival"));
}

function renderPlayerGrid() {
  const playerNumberGrid = document.getElementById("event-player-number-grid");
  if (!playerNumberGrid) return;
  playerNumberGrid.innerHTML = "";
  if (currentEventTeam !== "propio") return;
  lineupState.onField
    .slice()
    .sort((a, b) => Number(a.number) - Number(b.number))
    .forEach((p) => {
      const btnNum = document.createElement("button");
      btnNum.type = "button";
      btnNum.className = "number-cell";
      btnNum.textContent = p.number || "";
      btnNum.addEventListener("click", () => {
        currentEventMeta.playerNumber = String(p.number || "");
        const playerInput = document.getElementById("event-player-number");
        if (playerInput) playerInput.value = currentEventMeta.playerNumber;
        playerNumberGrid.querySelectorAll(".number-cell").forEach((b) => b.classList.remove("active"));
        btnNum.classList.add("active");
      });
      playerNumberGrid.appendChild(btnNum);
    });
}

function renderRecentEvents() {
  const list = document.getElementById("recent-events-list");
  if (!list) return;
  list.innerHTML = "";
  recentEvents.forEach((evt) => {
    const card = document.createElement("article");
    card.className = "recent-event-card";
    card.innerHTML = `
      <strong>${evt.title}</strong>
      <small>${evt.detail}</small>
      <span>${evt.time}</span>
    `;
    list.appendChild(card);
  });
}

function updateScoreboard() {
  const home = document.getElementById("score-home");
  const away = document.getElementById("score-away");
  if (home) home.textContent = String(matchScore.home);
  if (away) away.textContent = String(matchScore.away);
}

function setPitchZone(zone) {
  currentEventMeta.zone = zone;
  document.querySelectorAll(".pitch-zone").forEach((cell) => {
    cell.classList.toggle("active", cell.getAttribute("data-zone") === zone);
  });
  const marker = document.getElementById("pitch-marker");
  const position = zoneMarkerPositions[zone];
  if (!marker || !position) return;
  marker.style.left = `${position.x}%`;
  marker.style.top = `${position.y}%`;
  marker.classList.remove("hidden");
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
  const playsAsSelect = document.getElementById("plays-as-select");
  const playsAs = playsAsSelect ? playsAsSelect.value : "home";

  const periodBtn = document.getElementById("btn-period");

  // No permitir iniciar si no hay equipo propio guardado (nuevo partido)
  if (!teamConfig.teamName || !Array.isArray(teamConfig.players) || teamConfig.players.length === 0) {
    alert("Debes configurar y guardar tu equipo propio antes de iniciar un partido.");
    return;
  }

  const players = teamConfig.players || [];
  // Inicializar estado de alineación en campo / banquillo
  lineupState = { onField: [], bench: [] };
  players.forEach((p, index) => {
    const id = index + 1;
    const playerRef = {
      id,
      name: p.name,
      number: p.number,
      isStarter: !!p.isStarter,
    };
    if (p.isStarter) {
      lineupState.onField.push(playerRef);
    } else {
      lineupState.bench.push(playerRef);
    }
  });
  const lineup = players
    .map((p, index) => ({
      // en un futuro, mapear por playerId real si se gestiona en backend
      playerId: index + 1,
      isStarter: !!p.isStarter,
    }))
    .filter((p) => p.playerId);

  const res = await fetch("/api/matches", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      home,
      away,
      playsAs,
      lineup,
    }),
  });
  const data = await res.json();
  matchId = data.matchId;
  document.getElementById(
    "teams-label"
  ).textContent = `${home} vs ${away}`;
  updatePlaysAsIndicator();
  document.getElementById("match-footer-id").textContent = `Partido: ${matchId}`;
  document.getElementById("match-sync-status").textContent = "Estado: en vivo";
  document.getElementById("match-setup").classList.add("hidden");
  document.getElementById("match-meta").classList.remove("hidden");

  // Iniciar cronómetro automáticamente al iniciar partido
  startTimer();
  renderPlayerGrid();
  await syncRecentEvents();
  resetEventComposer();
  if (periodBtn) periodBtn.textContent = "Pausar";
}

function endMatch() {
  const endBtn = document.getElementById("end-match");
  const periodBtn = document.getElementById("btn-period");

  matchId = null;
  elapsed = 0;
  running = false;
  clearInterval(timerInterval);
  timerInterval = null;
  updateTimerDisplay();
  document.getElementById("match-meta").classList.add("hidden");
  document.getElementById("match-setup").classList.remove("hidden");
  recentEvents = [];
  matchScore = { home: 0, away: 0 };
  updatePlaysAsIndicator();
  document.getElementById("match-footer-id").textContent = "Partido: pendiente";
  document.getElementById("match-sync-status").textContent = "Estado: local";
  renderRecentEvents();
  updateScoreboard();
  resetEventComposer();

  if (periodBtn) periodBtn.textContent = "Iniciar periodo";
  if (endBtn) endBtn.textContent = "Finalizar partido";
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
    period: getCurrentPeriod(),
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
  await syncRecentEvents();
  resetEventComposer();
}

async function undoLast() {
  if (!matchId) return;
  await fetch(`/api/events/last?matchId=${encodeURIComponent(matchId)}`, {
    method: "DELETE",
  });
  await syncRecentEvents();
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
      updatePlaysAsIndicator();
    });

  document.getElementById("plays-as-select").addEventListener("change", () => {
    updatePlaysAsIndicator();
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
      let invalidPlayer = false;
      playersContainer.querySelectorAll(".player-row").forEach((row) => {
        const inputs = row.querySelectorAll("input");
        const nameInput = inputs[0];
        const numberInput = inputs[1];
        const positionInput = inputs[2];
        const starterCheckbox = inputs[3];
        const name = nameInput.value.trim();
        const number = numberInput.value.trim();
        const position = positionInput.value.trim();
        if (name || number || position) {
          if (!name || !number) {
            invalidPlayer = true;
            return;
          }
          players.push({
            name,
            number,
            position,
            isStarter: starterCheckbox.checked,
          });
        }
      });

      if (invalidPlayer) {
        msgEl.textContent =
          "Todos los jugadores deben tener nombre y dorsal.";
        return;
      }

      teamConfig = { teamName, players };
      saveTeamToStorage();

      // Actualizar solo el nombre del equipo en backend
      await fetch("/api/user/team", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: currentUser.userId, teamName, players }),
      });
      currentUser.teamName = teamName;
      currentUser.teamConfig = teamConfig;
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
    .getElementById("btn-period")
    .addEventListener("click", async () => {
      const periodBtn = document.getElementById("btn-period");
      // Si no hay partido aún, lo creamos y empezamos a contar
      if (!matchId) {
        await startMatch();
        return;
      }
      // Si ya hay partido, este botón actúa como iniciar/finalizar periodo (start/stop reloj)
      if (running) {
        pauseTimer();
        if (periodBtn) periodBtn.textContent = "Reanudar";
      } else {
        startTimer();
        if (periodBtn) periodBtn.textContent = "Pausar";
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

  document.getElementById("undo-event").addEventListener("click", () => undoLast());

  document.querySelectorAll(".tag-button").forEach((btn) => {
    const category = btn.getAttribute("data-category");
    const option = btn.getAttribute("data-option");
    if (category === "evento") {
      btn.addEventListener("click", () => {
        if (option === "Cambio") {
          pendingEventOption = option;
          document.getElementById("event-modal").classList.remove("hidden");
          const subOutSelect = document.getElementById("sub-out-player");
          const subInSelect = document.getElementById("sub-in-player");
          const modalBodySubstitution = document.getElementById("event-modal-body-substitution");
          modalBodySubstitution.classList.remove("hidden");
          subOutSelect.innerHTML = '<option value="">Sale...</option>';
          lineupState.onField.forEach((p) => {
            const opt = document.createElement("option");
            opt.value = String(p.id);
            opt.textContent = `${p.number} - ${p.name}`;
            subOutSelect.appendChild(opt);
          });
          subInSelect.innerHTML = '<option value="">Entra...</option>';
          lineupState.bench.forEach((p) => {
            const opt = document.createElement("option");
            opt.value = String(p.id);
            opt.textContent = `${p.number} - ${p.name}`;
            subInSelect.appendChild(opt);
          });
          return;
        }
        pendingEventOption = pendingEventOption === option ? null : option;
        document.querySelectorAll('.tag-button[data-category="evento"]').forEach((button) => {
          button.classList.toggle(
            "active",
            pendingEventOption !== null &&
              button.getAttribute("data-option") === pendingEventOption
          );
        });
      });
    }
  });

  // Toggle equipo propio / rival para los eventos
  const ownBtn = document.getElementById("btn-event-own");
  const rivalBtn = document.getElementById("btn-event-rival");
  if (ownBtn && rivalBtn) {
    setEventTeamSelection("propio");
    ownBtn.addEventListener("click", () => {
      setEventTeamSelection("propio");
      renderPlayerGrid();
    });
    rivalBtn.addEventListener("click", () => {
      setEventTeamSelection("rival");
      renderPlayerGrid();
    });
  }

  document.querySelectorAll(".pitch-zone").forEach((cell) => {
    cell.addEventListener("click", () => {
      setPitchZone(cell.getAttribute("data-zone") || "");
    });
  });

  document.querySelectorAll(".modifier-chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      const category = chip.getAttribute("data-category");
      const option = chip.getAttribute("data-option");
      if (!category || !option) return;
      toggleSelection(category, option);
      chip.classList.toggle("active");
    });
  });

  // Acciones del modal de evento
  const modal = document.getElementById("event-modal");
  const modalCancel = document.getElementById("event-modal-cancel");
  const modalOk = document.getElementById("event-modal-ok");
  const modalBodySubstitution = document.getElementById(
    "event-modal-body-substitution"
  );
  const subOutSelect = document.getElementById("sub-out-player");
  const subInSelect = document.getElementById("sub-in-player");

  modalCancel.addEventListener("click", () => {
    modal.classList.add("hidden");
    pendingEventOption = null;
    modalBodySubstitution.classList.add("hidden");
  });

  modalOk.addEventListener("click", () => {
    if (!pendingEventOption) {
      modal.classList.add("hidden");
      return;
    }

    if (pendingEventOption === "Cambio") {
      const outId = subOutSelect.value;
      const inId = subInSelect.value;
      if (!outId || !inId || outId === inId) {
        return;
      }
      const outPlayer = lineupState.onField.find((p) => String(p.id) === outId);
      const inPlayer = lineupState.bench.find((p) => String(p.id) === inId);
      if (!outPlayer || !inPlayer) {
        return;
      }

      // Actualizar estado local de alineación
      lineupState.onField = lineupState.onField.filter(
        (p) => p.id !== outPlayer.id
      );
      lineupState.bench = lineupState.bench.filter(
        (p) => p.id !== inPlayer.id
      );
      lineupState.onField.push(inPlayer);
      lineupState.bench.push(outPlayer);

      // Registrar evento de cambio
      selections["evento"] = new Set(["Cambio"]);
      const baseSelections = selectionsToObject ? selectionsToObject() : {};
      const total = elapsed + (running ? Date.now() - startTime : 0);
      const payload = {
        matchId,
        period: getCurrentPeriod(),
        tMatchMs: total,
        selections: {
          ...baseSelections,
          equipo: [
            currentEventTeam === "propio" ? "Equipo propio" : "Equipo rival",
          ],
          cambio_out: [outPlayer.number],
          cambio_in: [inPlayer.number],
        },
      };
      fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }).then(() => syncRecentEvents());
      renderPlayerGrid();

      modal.classList.add("hidden");
      pendingEventOption = null;
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

    // Registrar evento inmediatamente al cerrar el modal
    registerEvent();
  });

  updateTimerDisplay();
  updatePlaysAsIndicator();
  renderRecentEvents();
  updateScoreboard();
  renderPlayerGrid();

  document.getElementById("event-player-number").addEventListener("input", (event) => {
    currentEventMeta.playerNumber = event.target.value.trim();
    document.querySelectorAll(".number-cell").forEach((cell) => {
      cell.classList.toggle("active", cell.textContent === currentEventMeta.playerNumber);
    });
  });

  document.getElementById("discard-event").addEventListener("click", () => {
    resetEventComposer();
  });

  document.getElementById("confirm-event").addEventListener("click", () => {
    if (!pendingEventOption) {
      return;
    }
    selections.evento = new Set([pendingEventOption]);
    registerEvent();
  });
});
