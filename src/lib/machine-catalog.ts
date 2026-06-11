export type CatalogMachine = {
  id: string;
  codigo: string;
  qr_token: string;
  nome: string;
  modelo: string;
  ultimo_horimetro: null;
  ativo: true;
  local: true;
};

const rows = [
  ["28", "0016", "FROTA 16", "CARRETA PRANCHA"],
  ["32", "0068", "FROTA 68", "CAMINHAO PIPA"],
  ["31", "0070", "FROTA 70", "MOTONIVELADORA"],
  ["96", "0074", "FROTA 74", "ESCAVADEIRA HIDRAULICA"],
  ["33", "0084", "FROTA 84", "RETRO ESCAVADEIRA"],
  ["29", "0088", "FROTA 88", "MOTONIVELADORA"],
  ["30", "0090", "FROTA 90", "ROLO COMPACTADOR"],
  ["80", "0112", "FROTA 112", "CAMINHAO"],
  ["34", "0118", "FROTA 118", "MINI ESCAVADEIRA"],
  ["35", "0122", "FROTA 122", "TRATOR DE ESTEIRAS"],
  ["36", "0124", "FROTA 124", "TRATOR VALTRA"],
  ["37", "0128", "FROTA 128", "TRATOR DE ESTEIRAS"],
  ["38", "0142", "FROTA 142", "CAMINHAO PIPA"],
  ["39", "0156", "FROTA 156", "CARRETA PRANCHA"],
  ["40", "0164", "FROTA 164", "AUTOMOVEL"],
  ["77", "0182", "FROTA 182", "CAMINHAO PIPA"],
  ["41", "0192", "FROTA 192", "CAMINHAO COMBOIO"],
  ["42", "0194", "FROTA 194", "ESCAVADEIRA HIDRAULICA"],
  ["43", "0200", "FROTA 200", "CARRETA PRANCHA"],
  ["44", "0204", "FROTA 204", "AUTOMOVEL"],
  ["45", "0212", "FROTA 212", "AUTOMOVEL"],
  ["46", "0214", "FROTA 214", "CAMINHAO PIPA"],
  ["47", "0218", "FROTA 218", "AUTOMOVEL"],
  ["48", "0228", "FROTA 228", "ESCAVADEIRA HIDRAULICA"],
  ["49", "0230", "FROTA 230", "ESCAVADEIRA HIDRAULICA"],
  ["50", "0232", "FROTA 232", "ESCAVADEIRA HIDRAULICA"],
  ["51", "0236", "FROTA 236", "ESCAVADEIRA HIDRAULICA"],
  ["52", "0238", "FROTA 238", "ESCAVADEIRA HIDRAULICA"],
  ["53", "0240", "FROTA 240", "MOTONIVELADORA"],
  ["54", "0242", "FROTA 242", "MOTONIVELADORA"],
  ["55", "0244", "FROTA 244", "ESCAVADEIRA HIDRAULICA"],
  ["56", "0248", "FROTA 248", "AUTOMOVEL"],
  ["57", "0250", "FROTA 250", "ROLO COMPACTADOR"],
  ["58", "0254", "FROTA 254", "ROLO COMPACTADOR"],
  ["59", "0256", "FROTA 256", "ROLO COMPACTADOR"],
  ["60", "0258", "FROTA 258", "TRATOR JOHN DEERE"],
  ["61", "0260", "FROTA 260", "AUTOMOVEL"],
  ["62", "0262", "FROTA 262", "CAMINHAO COMBOIO"],
  ["63", "0264", "FROTA 264", "MOTONIVELADORA"],
  ["64", "0266", "FROTA 266", "CAMINHAO PIPA"],
  ["65", "0268", "FROTA 268", "ESCAVADEIRA HIDRAULICA"],
  ["66", "0270", "FROTA 270", "MOTO BOMBA"],
  ["67", "0272", "FROTA 272", "AUTOMOVEL"],
  ["68", "0274", "FROTA 274", "ROLO COMPACTADOR"],
  ["69", "0276", "FROTA 276", "AUTOMOVEL"],
  ["70", "0278", "FROTA 278", "MOTO BOMBA"],
  ["71", "0280", "FROTA 280", "AUTOMOVEL"],
  ["72", "0282", "FROTA 282", "TRATOR VALTRA"],
  ["73", "0284", "FROTA 284", "TRATOR VALTRA"],
  ["74", "0290", "FROTA 290", "MOTONIVELADORA"],
  ["75", "0292", "FROTA 292", "AUTOMOVEL"],
  ["76", "0294", "FROTA 294", "AUTOMOVEL"],
  ["89", "0296", "FROTA 296", "MOTO BOMBA"],
  ["84", "1", "1", "OUTROS"],
  ["79", "1111", "CB TESTE", "BASCULANTE"],
] as const;

export const machineCatalog: CatalogMachine[] = rows.map(([codigo, qrToken, nome, modelo]) => ({
  id: `local:${codigo}`,
  codigo,
  qr_token: qrToken,
  nome,
  modelo,
  ultimo_horimetro: null,
  ativo: true,
  local: true,
}));

function comparableValues(value: string) {
  const raw = value.trim().toUpperCase();
  const values = new Set([raw, raw.replace(/\s+/g, " ")]);
  const fleet = raw.match(/FROTA[\s:_-]*(\d+)/)?.[1];
  const groups = raw.match(/\d+/g) ?? [];

  for (const digits of fleet ? [fleet, ...groups] : groups) {
    const number = Number(digits);
    if (!Number.isSafeInteger(number)) continue;
    values.add(String(number));
    values.add(String(number).padStart(4, "0"));
    values.add(`FROTA ${number}`);
  }

  return values;
}

export function findCatalogMachine(value: string) {
  const candidates = comparableValues(value);
  return machineCatalog.find((machine) =>
    [machine.codigo, machine.qr_token, machine.nome].some((item) =>
      candidates.has(item.toUpperCase()),
    ),
  );
}
