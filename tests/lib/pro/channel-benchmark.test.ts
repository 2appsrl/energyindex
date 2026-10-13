/**
 * @vitest-environment node
 */
import { describe, it, expect } from "vitest";
import {
  parseChannelRows,
  pickReferenceChannel,
  channelPosition,
  isChannelUsable,
  lockProChannels,
  CHANNEL_ORDER,
  CHANNEL_MIN_SAMPLE,
  type ChannelSpreadStats,
} from "@/lib/pro/channel-benchmark";

const RPC_ROWS = [
  { channel: "placet_arera", p25_eur_mwh: "35.00", median_eur_mwh: "60.00", p75_eur_mwh: "100.00", n_offerte: 279 },
  { channel: "energiapro", p25_eur_mwh: "11.00", median_eur_mwh: "22.00", p75_eur_mwh: "38.00", n_offerte: 41 },
  { channel: "online_brand", p25_eur_mwh: null, median_eur_mwh: null, p75_eur_mwh: null, n_offerte: 0 },
];

function ch(id: ChannelSpreadStats["channel"], channels: ChannelSpreadStats[]) {
  return channels.find((c) => c.channel === id)!;
}

describe("parseChannelRows", () => {
  it("ritorna sempre i 3 canali in CHANNEL_ORDER", () => {
    const channels = parseChannelRows(RPC_ROWS);
    expect(channels.map((c) => c.channel)).toEqual(CHANNEL_ORDER);
  });

  it("converte le stringhe numeriche della RPC in number", () => {
    const channels = parseChannelRows(RPC_ROWS);
    const placet = ch("placet_arera", channels);
    expect(placet.medianEurPerMwh).toBe(60);
    expect(placet.p25EurPerMwh).toBe(35);
    expect(placet.p75EurPerMwh).toBe(100);
    expect(placet.nOfferte).toBe(279);
  });

  it("canale vuoto: percentili null, n=0, non usabile", () => {
    const channels = parseChannelRows(RPC_ROWS);
    const online = ch("online_brand", channels);
    expect(online.medianEurPerMwh).toBeNull();
    expect(online.nOfferte).toBe(0);
    expect(isChannelUsable(online)).toBe(false);
  });

  it("canale sotto soglia minima: percentili azzerati (campione non affidabile)", () => {
    const rows = [
      { ...RPC_ROWS[2], channel: "online_brand", p25_eur_mwh: "5", median_eur_mwh: "12", p75_eur_mwh: "18", n_offerte: CHANNEL_MIN_SAMPLE - 1 },
    ];
    const online = ch("online_brand", parseChannelRows(rows));
    expect(online.medianEurPerMwh).toBeNull();
    expect(online.nOfferte).toBe(CHANNEL_MIN_SAMPLE - 1);
  });

  it("input non-array (RPC fallita): 3 canali vuoti", () => {
    const channels = parseChannelRows(null);
    expect(channels).toHaveLength(3);
    expect(channels.every((c) => c.nOfferte === 0)).toBe(true);
  });
});

describe("pickReferenceChannel", () => {
  it("preferisce energiapro quando ha campione sufficiente", () => {
    const refCh = pickReferenceChannel(parseChannelRows(RPC_ROWS));
    expect(refCh?.channel).toBe("energiapro");
  });

  it("ripiega su placet_arera quando i canali commerciali sono vuoti", () => {
    const rows = [RPC_ROWS[0]];
    const refCh = pickReferenceChannel(parseChannelRows(rows));
    expect(refCh?.channel).toBe("placet_arera");
  });

  it("preferisce online_brand a placet quando energiapro manca", () => {
    const rows = [
      RPC_ROWS[0],
      { channel: "online_brand", p25_eur_mwh: "5", median_eur_mwh: "12", p75_eur_mwh: "18", n_offerte: 22 },
    ];
    const refCh = pickReferenceChannel(parseChannelRows(rows));
    expect(refCh?.channel).toBe("online_brand");
  });

  it("null quando tutti i canali sono vuoti", () => {
    expect(pickReferenceChannel(parseChannelRows([]))).toBeNull();
  });
});

describe("lockProChannels", () => {
  const ROWS_WITH_ONLINE = [
    ...RPC_ROWS.slice(0, 2),
    { channel: "online_brand", p25_eur_mwh: "5", median_eur_mwh: "12", p75_eur_mwh: "18", n_offerte: 9 },
  ];

  it("azzera i percentili del canale online e tiene il conteggio teaser", () => {
    const locked = lockProChannels(parseChannelRows(ROWS_WITH_ONLINE));
    const online = ch("online_brand", locked);
    expect(online.locked).toBe(true);
    expect(online.medianEurPerMwh).toBeNull();
    expect(online.p25EurPerMwh).toBeNull();
    expect(online.nOfferte).toBe(9);
    expect(isChannelUsable(online)).toBe(false);
  });

  it("non tocca gli altri canali", () => {
    const locked = lockProChannels(parseChannelRows(ROWS_WITH_ONLINE));
    expect(ch("placet_arera", locked).medianEurPerMwh).toBe(60);
    expect(ch("energiapro", locked).medianEurPerMwh).toBe(22);
    expect(ch("placet_arera", locked).locked).toBeUndefined();
  });

  it("un canale lockato non diventa canale di riferimento", () => {
    const rows = [ROWS_WITH_ONLINE[2]]; // solo online_brand con dati
    const locked = lockProChannels(parseChannelRows(rows));
    expect(pickReferenceChannel(locked)).toBeNull();
  });
});

describe("channelPosition", () => {
  const energiapro = ch("energiapro", parseChannelRows(RPC_ROWS)); // 11 / 22 / 38

  it("spread sotto il p25", () => {
    expect(channelPosition(8, energiapro)).toEqual({ label: "sotto il 25°", tone: "sotto" });
  });

  it("spread sotto mediana oltre il 10%: delta negativo", () => {
    const pos = channelPosition(15, energiapro);
    expect(pos?.tone).toBe("sotto");
    expect(pos?.label).toContain("-32%");
  });

  it("spread in mediana (entro ±10%)", () => {
    expect(channelPosition(22, energiapro)).toEqual({ label: "in mediana", tone: "inlinea" });
  });

  it("spread sopra mediana entro il p75: delta positivo", () => {
    const pos = channelPosition(30, energiapro);
    expect(pos?.tone).toBe("sopra");
    expect(pos?.label).toContain("+36%");
  });

  it("spread oltre il p75", () => {
    expect(channelPosition(45, energiapro)).toEqual({ label: "oltre il 75°", tone: "sopra" });
  });

  it("canale non usabile: null", () => {
    const online = ch("online_brand", parseChannelRows(RPC_ROWS));
    expect(channelPosition(20, online)).toBeNull();
  });
});
