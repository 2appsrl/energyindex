/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { DriverCard } from "@/components/home/DriverCard";
import { Droplets } from "lucide-react";

describe("DriverCard", () => {
  it("mostra titolo, unita' e valore", () => {
    render(
      <DriverCard
        href="/it/indice/brent"
        icon={Droplets}
        title="Brent"
        subtitle="Petrolio greggio"
        value={68.42}
        prevValue={67.88}
        unit="$/bbl"
      />,
    );
    expect(screen.getByText("Brent")).toBeInTheDocument();
    expect(screen.getByText(/68/)).toBeInTheDocument();
    expect(screen.getByText(/\$\/bbl/)).toBeInTheDocument();
  });

  it("mostra anomalia stagionale invece di % quando passata", () => {
    render(
      <DriverCard
        href="/it/indice/temperatura"
        icon={Droplets}
        title="Temperatura Italia"
        subtitle="Anomalia stagionale"
        value={19.5}
        unit="°C"
        anomaly={2.3}
        baselineLabel="vs media 2021-2025"
      />,
    );
    expect(screen.getByText(/\+2,3\s*°C/)).toBeInTheDocument();
    expect(screen.getByText(/vs media 2021-2025/)).toBeInTheDocument();
  });

  it("mostra 'Dati in arrivo' quando value e' null", () => {
    render(
      <DriverCard
        href="/it/indice/brent"
        icon={Droplets}
        title="Brent"
        subtitle="Petrolio"
        value={null}
        prevValue={null}
        unit="$/bbl"
      />,
    );
    expect(screen.getByText(/Dati in arrivo/i)).toBeInTheDocument();
  });
});
