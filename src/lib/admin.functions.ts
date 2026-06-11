import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Acesso restrito a administradores.");
}

// ===== MACHINES =====
export const listMachines = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("machines")
      .select("*")
      .order("codigo");
    if (error) throw new Error(error.message);
    return { machines: data ?? [] };
  });

export const createMachine = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        codigo: z.string().min(1).max(50),
        nome: z.string().min(1).max(200),
        modelo: z.string().max(200).optional(),
        ultimo_horimetro: z.number().min(0).max(9_999_999).nullable().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { data: m, error } = await context.supabase
      .from("machines")
      .insert({
        codigo: data.codigo,
        nome: data.nome,
        modelo: data.modelo ?? null,
        ultimo_horimetro: data.ultimo_horimetro ?? null,
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return { machine: m };
  });

export const updateMachine = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        nome: z.string().min(1).max(200).optional(),
        modelo: z.string().max(200).nullable().optional(),
        ativo: z.boolean().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { id, ...patch } = data;
    const { error } = await context.supabase.from("machines").update(patch).eq("id", id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ===== SITES (obras) =====
export const listSites = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("sites")
      .select("*")
      .order("codigo");
    if (error) throw new Error(error.message);
    return { sites: data ?? [] };
  });

export const createSite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        codigo: z.string().min(1).max(50),
        nome: z.string().min(1).max(200),
        lat: z.number().min(-90).max(90).nullable().optional(),
        lng: z.number().min(-180).max(180).nullable().optional(),
        raio_m: z.number().int().min(10).max(50000).default(500),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { data: s, error } = await context.supabase
      .from("sites")
      .insert({
        codigo: data.codigo,
        nome: data.nome,
        lat: data.lat ?? null,
        lng: data.lng ?? null,
        raio_m: data.raio_m,
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return { site: s };
  });

export const updateSite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        nome: z.string().min(1).max(200).optional(),
        lat: z.number().min(-90).max(90).nullable().optional(),
        lng: z.number().min(-180).max(180).nullable().optional(),
        raio_m: z.number().int().min(10).max(50000).optional(),
        ativo: z.boolean().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { id, ...patch } = data;
    const { error } = await context.supabase.from("sites").update(patch).eq("id", id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ===== PHOTO URL (signed) =====
export const getPhotoUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ path: z.string().min(1).max(500) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: signed, error } = await context.supabase.storage
      .from("horimeter-photos")
      .createSignedUrl(data.path, 60 * 10);
    if (error) throw new Error(error.message);
    return { url: signed.signedUrl };
  });
