import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { optionalSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { generateText } from "ai";
import { findCatalogMachine } from "@/lib/machine-catalog";

function normalizeMachineCode(value: string) {
  const raw = value.trim();
  let decoded = raw;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    // Keep the original QR payload when it is not URI encoded.
  }

  const candidates = new Set<string>();
  for (const source of [raw, decoded]) {
    candidates.add(source);
    candidates.add(source.toUpperCase());
    candidates.add(source.replace(/\s+/g, " "));

    const fleetMatch = source.match(/FROTA[\s:_-]*(\d+)/i);
    const digitGroups = source.match(/\d+/g) ?? [];
    const numbers = fleetMatch ? [fleetMatch[1], ...digitGroups] : digitGroups;

    for (const digits of numbers) {
      const number = Number(digits);
      if (!Number.isSafeInteger(number)) continue;
      candidates.add(digits);
      candidates.add(String(number));
      candidates.add(String(number).padStart(4, "0"));
      candidates.add(`FROTA ${number}`);
    }
  }

  return [...candidates].filter(Boolean);
}

function matchesMachineCode(
  machine: { codigo: string; qr_token: string; nome: string },
  value: string,
) {
  const candidates = normalizeMachineCode(value).map((candidate) => candidate.toUpperCase());
  const machineValues = [
    machine.codigo,
    machine.qr_token,
    machine.nome,
    machine.qr_token.replace(/^0+/, ""),
  ].map((candidate) => candidate.toUpperCase());

  return candidates.some((candidate) => machineValues.includes(candidate));
}

// ============================================================
// LOOKUP: máquina pelo QR token
// ============================================================
export const findMachineByQr = createServerFn({ method: "POST" })
  .middleware([optionalSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ qr_token: z.string().min(1).max(200) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: machines, error } = await context.supabase
      .from("machines")
      .select("id, codigo, qr_token, nome, modelo, ultimo_horimetro, ativo")
      .eq("ativo", true)
      .order("codigo");
    if (error) throw new Error(error.message);
    const machine =
      (machines ?? []).find((item: any) => matchesMachineCode(item, data.qr_token)) ??
      findCatalogMachine(data.qr_token);
    if (!machine) return { found: false as const };
    return { found: true as const, machine, ativo: true, local: "local" in machine };
  });

// ============================================================
// LOOKUP: máquina pelo código (fallback se QR estragado)
// ============================================================
export const findMachineByCode = createServerFn({ method: "POST" })
  .middleware([optionalSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ codigo: z.string().min(1).max(100) }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: machines, error } = await context.supabase
      .from("machines")
      .select("id, codigo, qr_token, nome, modelo, ultimo_horimetro, ativo")
      .eq("ativo", true)
      .order("codigo");
    if (error) throw new Error(error.message);
    const machine =
      (machines ?? []).find((item: any) => matchesMachineCode(item, data.codigo)) ??
      findCatalogMachine(data.codigo);
    return machine
      ? { found: true as const, machine, ativo: true, local: "local" in machine }
      : { found: false as const };
  });

export const findMachineById = createServerFn({ method: "POST" })
  .middleware([optionalSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: machine, error } = await context.supabase
      .from("machines")
      .select("id, codigo, qr_token, nome, modelo, ultimo_horimetro, ativo")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!machine) return { found: false as const };
    return { found: true as const, machine, ativo: machine.ativo };
  });

// ============================================================
// OBRAS: lista todas + sugere mais próxima
// ============================================================
function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371000;
  const toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export const suggestSite = createServerFn({ method: "POST" })
  .middleware([optionalSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        lat: z.number().optional(),
        lng: z.number().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: sites, error } = await context.supabase
      .from("sites")
      .select("id, codigo, nome, lat, lng, raio_m, ativo")
      .eq("ativo", true)
      .order("nome");
    if (error) throw new Error(error.message);

    let suggestedId: string | null = null;
    let bestScore = Infinity;
    if (data.lat != null && data.lng != null) {
      for (const s of sites ?? []) {
        if (s.lat == null || s.lng == null) continue;
        const d = haversineMeters(data.lat, data.lng, s.lat, s.lng);
        const inside = d <= (s.raio_m ?? 500);
        const score = inside ? d - 1_000_000 : d;
        if (score < bestScore) {
          bestScore = score;
          suggestedId = s.id;
        }
      }
    }
    return { sites: sites ?? [], suggestedId };
  });

// ============================================================
// OCR: lê horímetro de uma foto (base64 data URL)
// ============================================================
const OcrInput = z.object({
  imageDataUrl: z
    .string()
    .max(8_000_000) // ~8MB after base64
    .regex(/^data:image\/(jpeg|jpg|png|webp);base64,/),
  machineId: z.string().uuid().optional(),
  machineName: z.string().min(1).max(100),
  ultimoHorimetro: z.number().nullable().optional(),
});

export const readHorimeter = createServerFn({ method: "POST" })
  .middleware([optionalSupabaseAuth])
  .inputValidator((input: unknown) => OcrInput.parse(input))
  .handler(async ({ data, context }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY ausente");

    // Pega último horímetro como contexto
    const { data: remoteMachine } = data.machineId
      ? await context.supabase
          .from("machines")
          .select("ultimo_horimetro, nome")
          .eq("id", data.machineId)
          .maybeSingle()
      : { data: null };
    const machine = remoteMachine ?? {
      nome: data.machineName,
      ultimo_horimetro: data.ultimoHorimetro ?? null,
    };

    const { createLovableAiGatewayProvider } = await import("./ai-gateway.server");
    const gateway = createLovableAiGatewayProvider(apiKey);
    const model = gateway("google/gemini-3-flash-preview");

    const systemPrompt = `Você é um leitor de OCR especializado em horímetros de máquinas pesadas (escavadeiras, tratores, caminhões).
Retorne APENAS um JSON válido no formato:
{"valor": <numero decimal>, "confianca": <0 a 1>, "observacoes": "<string curta>"}

Regras:
- O valor é em HORAS. Use ponto como separador decimal (ex: 12345.6).
- Horímetros normalmente têm 5 a 7 dígitos inteiros e 1 casa decimal.
- Se não conseguir ler com segurança, confianca < 0.5 e observacoes explicando.
- Não invente valores. Em caso de dúvida, prefira confiança baixa.
- Nunca retorne texto fora do JSON.`;

    const userText =
      machine?.ultimo_horimetro != null
        ? `Máquina: ${machine.nome}. Último horímetro registrado: ${machine.ultimo_horimetro}. Leia o valor atual mostrado na foto.`
        : `Leia o valor mostrado no horímetro desta foto.`;

    let result;
    try {
      result = await generateText({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: [
              { type: "text", text: userText },
              { type: "image", image: data.imageDataUrl },
            ],
          },
        ],
      });
    } catch (err: any) {
      const status = err?.statusCode || err?.status;
      if (status === 429)
        return { ok: false as const, error: "Muitas requisições. Tente novamente em instantes." };
      if (status === 402)
        return { ok: false as const, error: "Créditos de IA esgotados. Contate o admin." };
      throw err;
    }

    const raw = result.text.trim().replace(/^```json\s*|\s*```$/g, "");
    let parsed: { valor: number; confianca: number; observacoes?: string };
    try {
      parsed = JSON.parse(raw);
    } catch {
      return { ok: false as const, error: "Resposta da IA inválida. Tente outra foto." };
    }
    if (typeof parsed.valor !== "number" || !isFinite(parsed.valor)) {
      return { ok: false as const, error: "Não foi possível identificar um número." };
    }
    return {
      ok: true as const,
      valor: parsed.valor,
      confianca: Math.max(0, Math.min(1, Number(parsed.confianca) || 0)),
      observacoes: parsed.observacoes ?? "",
    };
  });

// ============================================================
// SAVE READING: salva foto + leitura + atualiza turno
// ============================================================
const SaveInput = z.object({
  machineId: z.string().uuid(),
  tipo: z.enum(["inicio", "fim"]),
  valorOcr: z.number().nullable(),
  valorConfirmado: z.number().positive().max(9_999_999),
  confianca: z.number().min(0).max(1).nullable(),
  imageDataUrl: z
    .string()
    .max(8_000_000)
    .regex(/^data:image\/(jpeg|jpg|png|webp);base64,/),
  lat: z.number().nullable(),
  lng: z.number().nullable(),
  gpsAccuracy: z.number().nullable(),
  siteSugeridoId: z.string().uuid().nullable(),
  siteConfirmadoId: z.string().uuid().nullable(),
  observacoes: z.string().max(1000).optional(),
  clientCreatedAt: z.string().datetime(),
  deviceId: z.string().max(100).optional(),
});

export const saveReading = createServerFn({ method: "POST" })
  .middleware([optionalSupabaseAuth])
  .inputValidator((input: unknown) => SaveInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const operatorId = userId ?? null;

    // Valida máquina e horímetro anterior
    const { data: machine, error: mErr } = await supabase
      .from("machines")
      .select("id, ultimo_horimetro, ativo")
      .eq("id", data.machineId)
      .maybeSingle();
    if (mErr) throw new Error(mErr.message);
    if (!machine || !machine.ativo) throw new Error("Máquina inválida ou inativa.");

    // Regra: horímetro nunca pode ser menor que o último
    if (
      machine.ultimo_horimetro != null &&
      Number(data.valorConfirmado) < Number(machine.ultimo_horimetro)
    ) {
      throw new Error(
        `Horímetro (${data.valorConfirmado}) é menor que o último registrado (${machine.ultimo_horimetro}).`,
      );
    }

    // Pega ou cria shift
    let shiftId: string;
    if (data.tipo === "inicio") {
      // fecha shifts abertos prévios da mesma máquina/operador (segurança)
      const { data: openShifts } = await supabase
        .from("shifts")
        .select("id, operator_id")
        .eq("machine_id", data.machineId)
        .eq("status", "aberto");
      const matchingOpenShifts = operatorId
        ? (openShifts ?? []).filter((s: any) => s.operator_id === operatorId)
        : (openShifts ?? []).filter((s: any) => s.operator_id == null);
      if (matchingOpenShifts.length > 0) {
        await supabase
          .from("shifts")
          .update({ status: "cancelado" })
          .in(
            "id",
            matchingOpenShifts.map((s: any) => s.id),
          );
      }
      const { data: shift, error: sErr } = await supabase
        .from("shifts")
        .insert({
          operator_id: operatorId,
          machine_id: data.machineId,
          site_id: data.siteConfirmadoId,
          inicio_horimetro: data.valorConfirmado,
          inicio_at: data.clientCreatedAt,
          status: "aberto",
          observacoes: data.observacoes ?? null,
        })
        .select("id")
        .single();
      if (sErr) throw new Error(sErr.message);
      shiftId = shift.id;
    } else {
      let openShiftQuery = supabase
        .from("shifts")
        .select("id, inicio_horimetro")
        .eq("machine_id", data.machineId)
        .eq("status", "aberto")
        .order("inicio_at", { ascending: false })
        .limit(1);
      openShiftQuery = operatorId
        ? openShiftQuery.eq("operator_id", operatorId)
        : openShiftQuery.is("operator_id", null);
      const { data: openShifts, error: sErr } = await openShiftQuery;
      const openShift = openShifts?.[0];
      if (sErr) throw new Error(sErr.message);
      if (!openShift) throw new Error("Nenhum turno aberto encontrado para esta máquina.");
      if (
        openShift.inicio_horimetro != null &&
        Number(data.valorConfirmado) < Number(openShift.inicio_horimetro)
      ) {
        throw new Error(
          `Horímetro final (${data.valorConfirmado}) é menor que o inicial (${openShift.inicio_horimetro}).`,
        );
      }
      const { error: uErr } = await supabase
        .from("shifts")
        .update({
          fim_horimetro: data.valorConfirmado,
          fim_at: data.clientCreatedAt,
          status: "fechado",
        })
        .eq("id", openShift.id);
      if (uErr) throw new Error(uErr.message);
      shiftId = openShift.id;
    }

    // Cria leitura (sem foto path por enquanto)
    const { data: reading, error: rErr } = await supabase
      .from("readings")
      .insert({
        shift_id: shiftId,
        operator_id: operatorId,
        machine_id: data.machineId,
        tipo: data.tipo,
        valor_ocr: data.valorOcr,
        valor_confirmado: data.valorConfirmado,
        confianca: data.confianca,
        lat: data.lat,
        lng: data.lng,
        gps_accuracy_m: data.gpsAccuracy,
        site_sugerido_id: data.siteSugeridoId,
        site_confirmado_id: data.siteConfirmadoId,
        device_id: data.deviceId ?? null,
        client_created_at: data.clientCreatedAt,
      })
      .select("id")
      .single();
    if (rErr) throw new Error(rErr.message);

    // Upload da foto: path = <userId>/<shiftId>/<readingId>.jpg
    const b64 = data.imageDataUrl.split(",")[1];
    const buf = Buffer.from(b64, "base64");
    const path = `${operatorId ?? "anonymous"}/${shiftId}/${reading.id}.jpg`;
    const { error: upErr } = await supabase.storage
      .from("horimeter-photos")
      .upload(path, buf, { contentType: "image/jpeg", upsert: false });
    if (upErr) {
      // Sucesso parcial: leitura salva, mas foto falhou — registra na auditoria
      await supabase.from("audit_log").insert({
        actor_id: operatorId,
        entity: "reading",
        entity_id: reading.id,
        action: "photo_upload_failed",
        payload: { error: upErr.message },
      });
    } else {
      await supabase.from("readings").update({ foto_path: path }).eq("id", reading.id);
    }

    // Atualiza último horímetro da máquina
    await supabase
      .from("machines")
      .update({ ultimo_horimetro: data.valorConfirmado })
      .eq("id", data.machineId);

    // Auditoria
    await supabase.from("audit_log").insert({
      actor_id: operatorId,
      entity: "reading",
      entity_id: reading.id,
      action: "created",
      payload: {
        tipo: data.tipo,
        valor_ocr: data.valorOcr,
        valor_confirmado: data.valorConfirmado,
        confianca: data.confianca,
        site_sugerido_id: data.siteSugeridoId,
        site_confirmado_id: data.siteConfirmadoId,
      },
    });

    return { ok: true as const, readingId: reading.id, shiftId };
  });

// ============================================================
// HISTÓRICO do operador
// ============================================================
export const listMyReadings = createServerFn({ method: "POST" })
  .middleware([optionalSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ limit: z.number().int().min(1).max(100).default(30) }).parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    let query = context.supabase
      .from("readings")
      .select(
        `id, tipo, valor_confirmado, confianca, created_at, foto_path,
         machines:machine_id (codigo, nome),
         sites:site_confirmado_id (codigo, nome)`,
      )
      .order("created_at", { ascending: false })
      .limit(data.limit);
    query = context.userId
      ? query.eq("operator_id", context.userId)
      : query.is("operator_id", null);
    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);
    return { readings: rows ?? [] };
  });

// ============================================================
// TURNOS ABERTOS do operador
// ============================================================
export const listMyOpenShifts = createServerFn({ method: "POST" })
  .middleware([optionalSupabaseAuth])
  .handler(async ({ context }) => {
    let query = context.supabase
      .from("shifts")
      .select(
        `id, inicio_horimetro, inicio_at,
         machines:machine_id (id, codigo, nome, ultimo_horimetro),
         sites:site_id (codigo, nome)`,
      )
      .eq("status", "aberto")
      .order("inicio_at", { ascending: false });
    query = context.userId
      ? query.eq("operator_id", context.userId)
      : query.is("operator_id", null);
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return { shifts: data ?? [] };
  });

// ============================================================
// ROLE: descobre se é admin
// ============================================================
export const getMyRole = createServerFn({ method: "GET" })
  .middleware([optionalSupabaseAuth])
  .handler(async ({ context }) => {
    if (!context.userId) return { roles: [], isAdmin: false, userId: null };
    const { data, error } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    const roles = (data ?? []).map((r) => r.role);
    return { roles, isAdmin: roles.includes("admin"), userId: context.userId };
  });
