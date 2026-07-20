/**
 * Cluster di consumatori tipici per il Customer Simulator > Cluster Clienti.
 * Valori indicativi del consumo medio annuo italiano per profilo.
 */
export interface ConsumerCluster {
  id: string;
  label: string;
  icon: string;                  // emoji o simbolo (no Lucide perche' usiamo in print CSS)
  description: string;
  kwhAnno: number;               // consumo luce
  smcAnno: number;               // consumo gas (0 se all-electric)
  household: string;             // descrizione breve sotto il titolo
}

export const CLUSTERS: ConsumerCluster[] = [
  {
    id: "single",
    label: "Single",
    icon: "👤",
    description: "1 persona, monolocale o bilocale, riscaldamento a gas autonomo",
    kwhAnno: 1500,
    smcAnno: 800,
    household: "1 persona",
  },
  {
    id: "coppia",
    label: "Coppia",
    icon: "👫",
    description: "2 persone, bilocale o trilocale, riscaldamento gas",
    kwhAnno: 2200,
    smcAnno: 1100,
    household: "2 persone",
  },
  {
    id: "famiglia-piccola",
    label: "Famiglia 3-4",
    icon: "👨‍👩‍👧",
    description: "3-4 persone, appartamento medio, riscaldamento gas",
    kwhAnno: 2700,
    smcAnno: 1400,
    household: "3-4 persone",
  },
  {
    id: "famiglia-grande",
    label: "Famiglia 5+",
    icon: "👨‍👩‍👧‍👦",
    description: "5+ persone, villetta o appartamento grande",
    kwhAnno: 3500,
    smcAnno: 1800,
    household: "5+ persone",
  },
  {
    id: "all-electric",
    label: "All-electric",
    icon: "⚡",
    description: "Riscaldamento elettrico (pompa di calore) + cucina elettrica, no gas",
    kwhAnno: 5000,
    smcAnno: 0,
    household: "Pompa di calore",
  },
];
