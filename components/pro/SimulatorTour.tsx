"use client";

import { useState } from "react";
import { driver } from "driver.js";
import "driver.js/dist/driver.css";
import { trackEvent } from "@/lib/analytics";

const STEPS = [
  {
    element: "[data-tour='inputs']",
    popover: {
      title: "1. Profila il cliente",
      description:
        "Imposta tipologia, volume annuo, durata contratto. Il volume di default si aggiorna in base al profilo (PMI 250.000, famiglia 3.500 kWh, industria 5M kWh).",
    },
  },
  {
    element: "[data-tour='contract-type']",
    popover: {
      title: "2. Variabile o Fisso?",
      description:
        "Variabile (passthrough PUN): il cliente assorbe le oscillazioni di mercato, tu hai margine stabile. Fisso (lock-in): tu assumi il rischio prezzo — guadagni se PUN scende, perdi se sale.",
    },
  },
  {
    element: "[data-tour='pricing']",
    popover: {
      title: "3. Spread, CAC, churn",
      description:
        "Sposta gli slider: tutti i numeri qui sopra si ricalcolano in tempo reale. Lo spread vendita e' il tuo markup sul costo; il CAC e' quanto spendi per acquisire ogni cliente; il churn e' la quota che disdice ogni anno.",
    },
  },
  {
    element: "[data-tour='kpi']",
    popover: {
      title: "4. I 4 numeri chiave",
      description:
        "Costo di approvvigionamento, prezzo di vendita, margine atteso/anno e LTV totale netto. L'LTV include gia' churn e CAC: dice quanto vale davvero il cliente per te.",
    },
  },
  {
    element: "[data-tour='chart']",
    popover: {
      title: "5. Forecast PUN",
      description:
        "Il forecast pubblico Energy Index, con banda di confidenza 5-95% calibrata. Lo stesso modello che e' su /forecast — niente black box.",
    },
  },
  {
    element: "[data-tour='scenarios']",
    popover: {
      title: "6. Scenari stress + what-if",
      description:
        "I 4 scenari preset (freddo, TTF spike, recessione) mostrano shock tipici. Sotto, gli slider what-if ti fanno costruire scenari custom — sposta volume, costo, churn e vedi il margine deformarsi.",
    },
  },
  {
    element: "[data-tour='competitor']",
    popover: {
      title: "7. Mercato di riferimento",
      description:
        "Confronto live con le offerte ARERA (~500 offerte electricity variabile). Vedi se sei competitivo o premium rispetto al mediano di mercato.",
    },
  },
  {
    element: "[data-tour='actions']",
    popover: {
      title: "8. Salva, condividi, esporta",
      description:
        "Condividi link funziona ora (URL con i tuoi parametri). PDF brandizzato e save scenario sono funzioni Pro: registrati per accesso prioritario al lancio.",
    },
  },
];

export function SimulatorTour() {
  const [running, setRunning] = useState(false);

  function startTour() {
    trackEvent("eidx_pro_simulator_tour_start");
    setRunning(true);
    const d = driver({
      showProgress: true,
      nextBtnText: "Avanti",
      prevBtnText: "Indietro",
      doneBtnText: "Fine",
      progressText: "Step {{current}} di {{total}}",
      steps: STEPS,
      onDestroyed: () => {
        setRunning(false);
        trackEvent("eidx_pro_simulator_tour_end");
      },
    });
    d.drive();
  }

  return (
    <button
      type="button"
      onClick={startTour}
      disabled={running}
      className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-[#0a3d2e] text-white text-sm font-semibold shadow-sm hover:bg-[#0a3d2e]/90 transition-colors disabled:opacity-50"
    >
      <span aria-hidden>▶</span>
      Tour guidato (60s)
    </button>
  );
}
