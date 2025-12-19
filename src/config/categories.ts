export type CategoryKey =
  | "inicioJuego"
  | "defensa"
  | "transicionAD"
  | "transicionDA"
  | "tiros"
  | "abp"
  | "faltasFavor";

export interface CategoryConfig {
  key: CategoryKey;
  label: string;
  tone: "red" | "blue" | "dark";
  options: string[];
}

// Config derivado del diseño de referencia.
export const categoryConfig: CategoryConfig[] = [
  {
    key: "inicioJuego",
    label: "INICIO JUEGO",
    tone: "red",
    options: ["Corto", "Largo", "Combinativo", "Directo"],
  },
  {
    key: "defensa",
    label: "DEFENSA",
    tone: "red",
    options: ["Bloque alto", "Bloque medio", "Despliegue", "Presión rival"],
  },
  {
    key: "transicionAD",
    label: "TRANSICION AD",
    tone: "dark",
    options: ["Presión tras pérdida", "Repliegue"],
  },
  {
    key: "transicionDA",
    label: "TRANSICION DA",
    tone: "dark",
    options: ["Contragolpe", "Conservadora"],
  },
  {
    key: "tiros",
    label: "TIROS",
    tone: "blue",
    options: ["A puerta", "Fuera", "Parada", "Gol (G)"],
  },
  {
    key: "abp",
    label: "ABP",
    tone: "blue",
    options: ["Saque puerta", "Saque banda", "Falta", "Corner"],
  },
  {
    key: "faltasFavor",
    label: "",
    tone: "dark",
    options: ["A favor", "En contra", "Lateral", "Central"],
  },
];
