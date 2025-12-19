import React, { useState } from "react";
import "../styles/app.css";
import { TagButton } from "../components/TagButton";
import { categoryConfig, CategoryKey } from "../config/categories";
import { useSelections } from "../features/selections/useSelections";

const possessionStates = ["Posesión propia", "No posesión (S)", "Posesión rival"];
const periods: Array<{ key: "1T" | "2T"; label: string }> = [
  { key: "1T", label: "1er tiempo" },
  { key: "2T", label: "2o tiempo" },
];

export const App: React.FC = () => {
  const [period, setPeriod] = useState<"1T" | "2T">("1T");
  const [possession, setPossession] = useState<string>(possessionStates[0]);
  const { selections, toggle, resetCategory } = useSelections();

  return (
    <div className="screen">
      <header className="topbar">
        <div className="brand">BasicPlus_Futbol</div>
        <div className="controls">
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
        </div>
      </header>

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
          <PitchZones />
        </section>
      </main>
    </div>
  );
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

const PitchZones: React.FC = () => {
  return (
    <div className="pitch-card">
      <div className="zone">
        <span className="dot red-dot" />
        <Field />
      </div>
      <div className="zone">
        <span className="dot red-dot" />
        <Field />
      </div>
      <div className="zone">
        <span className="dot red-dot" />
        <Field />
      </div>
    </div>
  );
};

const Field: React.FC = () => (
  <div className="field">
    <div className="line penalty" />
    <div className="line mid" />
    <div className="line penalty right" />
    <div className="circle" />
  </div>
);
