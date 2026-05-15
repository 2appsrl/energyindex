/**
 * Driver attribution per forecast: dato un modello Ridge addestrato e la riga
 * di feature di oggi, calcola il contributo (in EUR) di ogni feature al forecast,
 * ordinato per magnitudine assoluta.
 *
 * Formula: contribution_i = coefficient_i * (feature_today[i] - feature_mean_training[i])
 *
 * Il top 3-4 viene esposto user-facing nelle pagine forecast con etichetta
 * leggibile (es. "ttf_lag_1" -> "TTF Europa ultimo dato").
 */

export interface AttributionInput {
  featureNames: string[];
  coefficients: number[];
  featureRow: number[];               // valori di oggi (non standardizzati)
  featureMeansTraining: number[];     // medie training (non standardizzate)
}

export interface DriverContribution {
  name: string;                       // nome tecnico (es. "ttf_lag_1")
  label: string;                      // etichetta user-facing in italiano
  contribution: number;               // delta in unita' del target (es. EUR/MWh)
  direction: "up" | "down";
}

const LABELS: Record<string, string> = {
  target_lag_1: "Prezzo di ieri",
  target_lag_7: "Trend settimanale",
  target_lag_30: "Trend mensile",
  target_mean_7: "Media ultima settimana",
  target_mean_30: "Media ultimo mese",
  target_std_30: "Volatilita' recente",
  ttf_lag_1: "TTF Europa (gas)",
  ttf_lag_7: "TTF Europa (trend settimanale)",
  brent_lag_1: "Brent petrolio",
  brent_lag_7: "Brent petrolio (trend)",
  co2_lag_1: "CO2 EU ETS",
  co2_lag_7: "CO2 EU ETS (trend)",
  psv_lag_1: "PSV gas Italia",
  psv_lag_7: "PSV gas Italia (trend)",
  hdd_lag1: "Temperature (riscaldamento)",
  cdd_lag1: "Temperature (raffrescamento)",
  is_holiday: "Festivita'",
  sin_year: "Stagionalita' annuale",
  cos_year: "Stagionalita' annuale",
  sin_week: "Pattern settimanale",
  cos_week: "Pattern settimanale",
  // Mappe per i prefissi lag_X_target (naming alternativo)
  lag_1_target: "Storico prezzo (1 giorno)",
  lag_7_target: "Storico prezzo (7 giorni)",
  lag_30_target: "Storico prezzo (30 giorni)",
};

function labelize(name: string): string {
  if (LABELS[name]) return LABELS[name];
  if (name.startsWith("dow_")) return "Giorno della settimana";
  if (name.startsWith("month_")) return "Mese dell'anno";
  return name; // fallback raw
}

/** Aggrega contributi per gruppo logico (es. tutti i dow_* in "Giorno della settimana"). */
function groupKey(name: string): string {
  if (name.startsWith("dow_")) return "calendar_dow";
  if (name.startsWith("month_")) return "calendar_month";
  if (name === "sin_year" || name === "cos_year") return "seasonal_year";
  if (name === "sin_week" || name === "cos_week") return "seasonal_week";
  return name;
}

export function computeAttribution(
  input: AttributionInput,
  topK: number,
): DriverContribution[] {
  const { featureNames, coefficients, featureRow, featureMeansTraining } = input;
  if (featureNames.length !== coefficients.length)
    throw new Error("attribution: featureNames vs coefficients dim mismatch");
  if (featureRow.length !== coefficients.length)
    throw new Error("attribution: featureRow vs coefficients dim mismatch");

  // 1) Contributo per ogni feature singola
  type Raw = { name: string; group: string; contribution: number };
  const raw: Raw[] = featureNames.map((name, i) => ({
    name,
    group: groupKey(name),
    contribution: coefficients[i] * (featureRow[i] - featureMeansTraining[i]),
  }));

  // 2) Aggrega per group: somma contributi, ma per il nome esponiamo il primo
  const byGroup = new Map<string, Raw>();
  for (const r of raw) {
    const existing = byGroup.get(r.group);
    if (!existing) byGroup.set(r.group, { ...r });
    else existing.contribution += r.contribution;
  }

  // 3) Ordina per |contribution| desc, prendi topK
  const sorted = [...byGroup.values()].sort(
    (a, b) => Math.abs(b.contribution) - Math.abs(a.contribution),
  );

  return sorted.slice(0, topK).map((r) => ({
    name: r.name,
    label: labelize(r.name),
    contribution: Math.round(r.contribution * 100) / 100,
    direction: r.contribution >= 0 ? "up" : "down",
  }));
}
