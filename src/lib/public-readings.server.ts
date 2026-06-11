import { createClient } from "@supabase/supabase-js";
import { generateText } from "ai";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";

const PublicReadingInput = z.object({
  machine_code: z.string().min(1).max(200),
  tipo: z.enum(["inicio", "fim"]),
  operator_email: z.string().email().optional(),
  image_base64: z
    .string()
    .max(8_000_000)
    .regex(/^data:image\/(jpeg|jpg|png|webp);base64,/),
  lat: z.number().min(-90).max(90).nullable().optional(),
  lng: z.number().min(-180).max(180).nullable().optional(),
  gps_accuracy_m: z.number().min(0).nullable().optional(),
  site_code: z.string().min(1).max(100).optional(),
  device_id: z.string().max(100).optional(),
  observacoes: z.string().max(1000).optional(),
});

function json(data: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "access-control-allow-origin": "*",
      "access-control-allow-headers": "content-type, x-api-key",
      "access-control-allow-methods": "POST, OPTIONS",
      ...(init?.headers ?? {}),
    },
  });
}

function getSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_PUBLISHABLE_KEY;

  if (!url || !key) {
    throw new Error("Supabase não configurado no servidor.");
  }

  return createClient<Database>(url, key, {
    auth: {
      storage: undefined,
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

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

  return [...candidates].filter(Boolean).map((candidate) => candidate.toUpperCase());
}

function machineMatches(
  machine: { codigo: string; qr_token: string; nome: string },
  value: string,
) {
  const candidates = normalizeMachineCode(value);
  const machineValues = [
    machine.codigo,
    machine.qr_token,
    machine.nome,
    machine.qr_token.replace(/^0+/, ""),
  ].map((candidate) => candidate.toUpperCase());

  return candidates.some((candidate) => machineValues.includes(candidate));
}

async function readHorimeterWithAi(
  imageDataUrl: string,
  machine: { nome: string; ultimo_horimetro: unknown },
) {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) throw new Error("LOVABLE_API_KEY ausente para leitura com IA.");

  const { createLovableAiGatewayProvider } = await import("./ai-gateway.server");
  const gateway = createLovableAiGatewayProvider(apiKey);
  const model = gateway("google/gemini-3-flash-preview");

  const lastValue = machine.ultimo_horimetro == null ? null : Number(machine.ultimo_horimetro);
  const systemPrompt = `Você é um leitor de OCR especializado em horímetros de máquinas pesadas.
Retorne APENAS JSON válido no formato {"valor": number, "confianca": number, "observacoes": string}.
O valor é em horas, com ponto decimal. Não invente valores. Se houver dúvida, use confiança baixa.`;
  const userText =
    lastValue == null
      ? `Máquina: ${machine.nome}. Leia o horímetro mostrado na foto.`
      : `Máquina: ${machine.nome}. Último horímetro registrado: ${lastValue}. Leia o horímetro atual mostrado na foto.`;

  const result = await generateText({
    model,
    messages: [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content: [
          { type: "text", text: userText },
          { type: "image", image: imageDataUrl },
        ],
      },
    ],
  });

  const raw = result.text.trim().replace(/^```json\s*|\s*```$/g, "");
  const parsed = JSON.parse(raw) as { valor: number; confianca?: number; observacoes?: string };

  if (typeof parsed.valor !== "number" || !Number.isFinite(parsed.valor)) {
    throw new Error("A IA não retornou um horímetro válido.");
  }

  return {
    valor: parsed.valor,
    confianca: Math.max(0, Math.min(1, Number(parsed.confianca) || 0)),
    observacoes: parsed.observacoes ?? "",
  };
}

export async function handlePublicReadingRequest(request: Request) {
  if (request.method === "OPTIONS") return json({ ok: true });
  if (request.method !== "POST")
    return json({ ok: false, error: "Método não permitido." }, { status: 405 });

  const expectedKey = process.env.HORIMETER_API_KEY ?? "123";
  if (request.headers.get("x-api-key") !== expectedKey) {
    return json({ ok: false, error: "API key inválida." }, { status: 401 });
  }

  let input: z.infer<typeof PublicReadingInput>;
  try {
    input = PublicReadingInput.parse(await request.json());
  } catch (error) {
    return json({ ok: false, error: "Payload inválido.", details: String(error) }, { status: 400 });
  }

  try {
    const supabase = getSupabase();
    const { data: machines, error: machineError } = await supabase
      .from("machines")
      .select("id, codigo, qr_token, nome, modelo, ultimo_horimetro, ativo")
      .eq("ativo", true)
      .order("codigo");
    if (machineError) throw new Error(machineError.message);

    const machine = (machines ?? []).find((item) => machineMatches(item, input.machine_code));
    if (!machine) return json({ ok: false, error: "Máquina não cadastrada." }, { status: 404 });

    let siteId: string | null = null;
    if (input.site_code) {
      const { data: site, error: siteError } = await supabase
        .from("sites")
        .select("id")
        .eq("codigo", input.site_code)
        .eq("ativo", true)
        .maybeSingle();
      if (siteError) throw new Error(siteError.message);
      siteId = site?.id ?? null;
    }

    const ai = await readHorimeterWithAi(input.image_base64, machine);
    const lastValue = machine.ultimo_horimetro == null ? null : Number(machine.ultimo_horimetro);
    if (lastValue != null && ai.valor < lastValue) {
      return json(
        {
          ok: false,
          error: `Horímetro (${ai.valor}) menor que o último registrado (${lastValue}).`,
          machine,
          horimeter: ai,
        },
        { status: 422 },
      );
    }

    let shiftId: string;
    if (input.tipo === "inicio") {
      const { data: openShifts } = await supabase
        .from("shifts")
        .select("id")
        .eq("machine_id", machine.id)
        .is("operator_id", null)
        .eq("status", "aberto");
      if (openShifts?.length) {
        await supabase
          .from("shifts")
          .update({ status: "cancelado" })
          .in(
            "id",
            openShifts.map((shift) => shift.id),
          );
      }

      const { data: shift, error: shiftError } = await supabase
        .from("shifts")
        .insert({
          operator_id: null,
          machine_id: machine.id,
          site_id: siteId,
          inicio_horimetro: ai.valor,
          inicio_at: new Date().toISOString(),
          status: "aberto",
          observacoes: input.observacoes ?? input.operator_email ?? null,
        })
        .select("id")
        .single();
      if (shiftError) throw new Error(shiftError.message);
      shiftId = shift.id;
    } else {
      const { data: shifts, error: shiftError } = await supabase
        .from("shifts")
        .select("id, inicio_horimetro")
        .eq("machine_id", machine.id)
        .is("operator_id", null)
        .eq("status", "aberto")
        .order("inicio_at", { ascending: false })
        .limit(1);
      if (shiftError) throw new Error(shiftError.message);
      const shift = shifts?.[0];
      if (!shift)
        return json({ ok: false, error: "Nenhum turno aberto para finalizar." }, { status: 409 });

      const { error: updateShiftError } = await supabase
        .from("shifts")
        .update({
          fim_horimetro: ai.valor,
          fim_at: new Date().toISOString(),
          status: "fechado",
        })
        .eq("id", shift.id);
      if (updateShiftError) throw new Error(updateShiftError.message);
      shiftId = shift.id;
    }

    const { data: reading, error: readingError } = await supabase
      .from("readings")
      .insert({
        shift_id: shiftId,
        operator_id: null,
        machine_id: machine.id,
        tipo: input.tipo,
        valor_ocr: ai.valor,
        valor_confirmado: ai.valor,
        confianca: ai.confianca,
        lat: input.lat ?? null,
        lng: input.lng ?? null,
        gps_accuracy_m: input.gps_accuracy_m ?? null,
        site_sugerido_id: siteId,
        site_confirmado_id: siteId,
        device_id: input.device_id ?? "public-api",
        client_created_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (readingError) throw new Error(readingError.message);

    const b64 = input.image_base64.split(",")[1];
    const path = `api/${shiftId}/${reading.id}.jpg`;
    await supabase.storage.from("horimeter-photos").upload(path, Buffer.from(b64, "base64"), {
      contentType: "image/jpeg",
      upsert: true,
    });
    await supabase.from("readings").update({ foto_path: path }).eq("id", reading.id);
    await supabase.from("machines").update({ ultimo_horimetro: ai.valor }).eq("id", machine.id);

    return json({
      ok: true,
      machine: {
        id: machine.id,
        codigo: machine.codigo,
        qr_token: machine.qr_token,
        nome: machine.nome,
        modelo: machine.modelo,
      },
      horimeter: ai,
      reading_id: reading.id,
      shift_id: shiftId,
    });
  } catch (error: any) {
    console.error(error);
    return json({ ok: false, error: error.message ?? "Erro interno." }, { status: 500 });
  }
}
