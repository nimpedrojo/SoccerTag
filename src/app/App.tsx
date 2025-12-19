import React, { useState } from "react";
import "../styles/app.css";
import { TagButton } from "../components/TagButton";
import { categoryConfig, CategoryKey } from "../config/categories";
import { useSelections } from "../features/selections/useSelections";
import { useMatchTimer } from "../features/timer/useMatchTimer";
import { createMatchEvent, persistMatchEvent } from "../services/events";

const possessionStates = ["Posesión propia", "No posesión (S)", "Posesión rival"];
const periods: Array<{ key: "1T" | "2T"; label: string }> = [
  { key: "1T", label: "1er tiempo" },
  { key: "2T", label: "2o tiempo" },
];

export const App: React.FC = () => {
  const { tMatchMs, running, start, pause, reset, period, setPeriod } = useMatchTimer({
    initialPeriod: "1T",
  });
  const [possession, setPossession] = useState<string>(possessionStates[0]);
  const { selections, toggle, resetCategory, toObject } = useSelections();
  const [matchId, setMatchId] = useState("match-001");
  const [saveStatus, setSaveStatus] = useState<string>("");
  const [zone, setZone] = useState<"bajo" | "medio" | "alto" | null>(null);

  const handleSaveEvent = async () => {
    if (!matchId.trim()) {
      setSaveStatus("Falta matchId");
      return;
    }
    setSaveStatus("Guardando...");
    try {
      const event = createMatchEvent({
        matchId: matchId.trim(),
        period,
        tMatchMs,
        selections: {
          ...toObject(),
          zonaCampo: zone ? [zone] : [],
        },
      });
      await persistMatchEvent(event);
      setSaveStatus("Evento guardado");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error inesperado";
      setSaveStatus(`Error: ${msg}`);
    }
    setTimeout(() => setSaveStatus(""), 2000);
  };

  return (
    <div className="screen">
      <header className="topbar">
        <div className="controls horizontal">
          <div className="periods">
            {periods.map((p) => (
              <button
                key={p.key}
                className={`pill ${period === p.key ? "active" : ""}`}
                onClick={() => setPeriod(p.key)}
              >
                {p.label}
              </button>
            ))}
          </div>
          <div className="possession">
            {possessionStates.map((p) => (
              <button
                key={p}
                className={`pill ${possession === p ? "active" : ""}`}
                onClick={() => setPossession(p)}
              >
                {p}
              </button>
            ))}
          </div>
          <div className="timer-box inline">
            <div className="time-label">{formatTime(tMatchMs)}</div>
            <div className="timer-actions">
              <button
                className={`pill primary ${running ? "active" : ""}`}
                onClick={running ? pause : start}
              >
                {running ? "Pausar" : "Iniciar"}
              </button>
              <button className="pill subtle" onClick={() => reset()}>
                Reset
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="actionbar">
        <div className="match-id">
          <label htmlFor="matchId">Match ID</label>
          <input
            id="matchId"
            value={matchId}
            onChange={(e) => setMatchId(e.target.value)}
            placeholder="match-001"
          />
        </div>
        <button className="pill primary" onClick={async () => await handleSaveEvent()}>
          Guardar evento
        </button>
        <div className="status">{saveStatus}</div>
      </div>

      <main className="layout">
        <section className="panel tags">
          <div className="grid red-grid">
            {categoryConfig
              .filter((c) => c.tone === "red")
              .map((cat) => (
                <div key={cat.key} className="block">
                  <div className="block-title red">{cat.label}</div>
                  <div className="option-column">
                    {cat.options.map((opt) => (
                      <TagButton
                        key={opt}
                        tone="red"
                        label={opt}
                        active={selections[cat.key].has(opt)}
                        onClick={() => toggle(cat.key, opt)}
                      />
                    ))}
                  </div>
                  <button className="reset-link" onClick={() => resetCategory(cat.key)}>
                    Reset
                  </button>
                </div>
              ))}
          </div>

          <div className="grid blue-grid">
            {categoryConfig
              .filter((c) => c.tone === "blue")
              .map((cat) => (
                <div key={cat.key} className="block">
                  <div className="block-title blue">{cat.label}</div>
                  <div className="option-column">
                    {cat.options.map((opt) => (
                      <TagButton
                        key={opt}
                        tone="blue"
                        label={opt}
                        active={selections[cat.key].has(opt)}
                        onClick={() => toggle(cat.key, opt)}
                      />
                    ))}
                  </div>
                  <button className="reset-link" onClick={() => resetCategory(cat.key)}>
                    Reset
                  </button>
                </div>
              ))}
          </div>

          <div className="grid dark-grid">
            {categoryConfig
              .filter((c) => c.tone === "dark")
              .map((cat) => (
                <div key={cat.key} className="block">
                  {cat.label && <div className="block-title dark">{cat.label}</div>}
                  <div className="option-column two-columns">
                    {cat.options.map((opt) => (
                      <TagButton
                        key={opt}
                        tone="dark"
                        label={opt}
                        active={selections[cat.key].has(opt)}
                        onClick={() => toggle(cat.key, opt)}
                      />
                    ))}
                  </div>
                  <button className="reset-link" onClick={() => resetCategory(cat.key)}>
                    Reset
                  </button>
                </div>
              ))}
          </div>
        </section>

        <section className="panel right">
          <PlayersGrid />
          <PitchZones zone={zone} onSelect={setZone} />
        </section>
      </main>
    </div>
  );
};

const formatTime = (ms: number) => {
  const totalSeconds = Math.floor(ms / 1000);
  const mm = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, "0");
  const ss = (totalSeconds % 60).toString().padStart(2, "0");
  return `${mm}:${ss}`;
};


const PlayersGrid: React.FC = () => {
  const players = ["1", "2", "4", "5", "3", "8", "10", "6", "11", "9", "7"];
  return (
    <div className="players-card">
      <div className="jersey keeper">
        <span className="jersey-number">1</span>
      </div>
      <div className="players-grid">
        {players.slice(1).map((num) => (
          <div key={num} className="jersey">
            <span className="dot red-dot" />
            <span className="jersey-number">{num}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

interface PitchZonesProps {
  zone: "bajo" | "medio" | "alto" | null;
  onSelect: (z: "bajo" | "medio" | "alto") => void;
}

const PitchZones: React.FC<PitchZonesProps> = ({ zone, onSelect }) => {
  return (
    <div className="pitch-card single">
      <div className="field">
        <div className="line penalty" />
        <div className="line mid" />
        <div className="line penalty right" />
        <div className="circle" />
        <button
          className={`zone-overlay top ${zone === "alto" ? "active" : ""}`}
          onClick={() => onSelect("alto")}
        >
          Bloque alto
        </button>
        <button
          className={`zone-overlay middle ${zone === "medio" ? "active" : ""}`}
          onClick={() => onSelect("medio")}
        >
          Bloque medio
        </button>
        <button
          className={`zone-overlay bottom ${zone === "bajo" ? "active" : ""}`}
          onClick={() => onSelect("bajo")}
        >
          Bloque bajo
        </button>
      </div>
    </div>
  );
};
