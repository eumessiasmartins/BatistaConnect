import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { cpfToEmail, isValidCpf, onlyDigits } from "./cpf";

const roleSchema = z.enum(["superadmin", "admin", "user"]);

async function assertCanManage(supabase: any, userId: string) {
  const { data, error } = await supabase.rpc("has_permission", {
    _user_id: userId,
    _perm: "collaborators.manage",
  });
  if (error || !data) throw new Error("Sem permissão para gerenciar colaboradores.");
}

async function assertSuperadminForRole(supabase: any, userId: string, role: string) {
  if (role !== "superadmin") return;
  const { data } = await supabase.rpc("has_role", { _user_id: userId, _role: "superadmin" });
  if (!data) throw new Error("Apenas o superadmin pode atribuir o perfil superadmin.");
}

export const createCollaborator = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        full_name: z.string().trim().min(2).max(120),
        cpf: z.string(),
        password: z.string().min(6).max(72),
        job_title: z.string().max(120).optional(),
        department: z.string().max(120).optional(),
        phone: z.string().max(30).optional(),
        role: roleSchema,
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertCanManage(context.supabase, context.userId);
    await assertSuperadminForRole(context.supabase, context.userId, data.role);
    if (!isValidCpf(data.cpf)) throw new Error("CPF inválido.");
    const cpf = onlyDigits(data.cpf);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: cpfToEmail(cpf),
      password: data.password,
      email_confirm: true,
      user_metadata: {
        full_name: data.full_name,
        cpf,
        job_title: data.job_title,
        department: data.department,
      },
    });
    if (error || !created.user) {
      throw new Error(
        error?.message?.includes("already") ? "Já existe um colaborador com este CPF." : error?.message ?? "Erro ao criar.",
      );
    }
    await supabaseAdmin.from("profiles").update({ phone: data.phone ?? null }).eq("id", created.user.id);
    await supabaseAdmin.from("user_roles").insert({ user_id: created.user.id, role: data.role });
    return { id: created.user.id };
  });

export const updateCollaborator = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        full_name: z.string().trim().min(2).max(120),
        job_title: z.string().max(120).nullable().optional(),
        department: z.string().max(120).nullable().optional(),
        phone: z.string().max(30).nullable().optional(),
        role: roleSchema,
        active: z.boolean(),
        password: z.string().min(6).max(72).optional().or(z.literal("")),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertCanManage(context.supabase, context.userId);
    await assertSuperadminForRole(context.supabase, context.userId, data.role);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: target } = await supabaseAdmin.from("user_roles").select("role").eq("user_id", data.id);
    const targetIsSuper = (target ?? []).some((r) => r.role === "superadmin");
    if (targetIsSuper) {
      const { data: me } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "superadmin" });
      if (!me) throw new Error("Apenas o superadmin pode editar outro superadmin.");
    }
    if (data.id === context.userId && (!data.active || (targetIsSuper && data.role !== "superadmin"))) {
      throw new Error("Você não pode desativar ou rebaixar a si mesmo.");
    }
    await supabaseAdmin
      .from("profiles")
      .update({
        full_name: data.full_name,
        job_title: data.job_title ?? null,
        department: data.department ?? null,
        phone: data.phone ?? null,
        active: data.active,
      })
      .eq("id", data.id);
    await supabaseAdmin.from("user_roles").delete().eq("user_id", data.id);
    await supabaseAdmin.from("user_roles").insert({ user_id: data.id, role: data.role });
    const attrs: { password?: string; ban_duration: string } = { ban_duration: data.active ? "none" : "876000h" };
    if (data.password) attrs.password = data.password;
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.id, attrs);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
