import { queryOptions, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type Role = "superadmin" | "admin" | "user";
export const ROLE_LABEL: Record<Role, string> = {
  superadmin: "Superadmin",
  admin: "Administrador",
  user: "Colaborador",
};

export const PERMISSIONS = [
  { key: "post.create", label: "Criar postagens", group: "Timeline" },
  { key: "announcement.create", label: "Criar comunicados", group: "Timeline" },
  { key: "event.create", label: "Criar eventos", group: "Timeline" },
  { key: "poll.create", label: "Criar enquetes", group: "Timeline" },
  { key: "posts.moderate", label: "Moderar publicações e comentários", group: "Timeline" },
  { key: "collaborators.manage", label: "Gerenciar colaboradores", group: "Configurações" },
  { key: "company.manage", label: "Editar dados da empresa", group: "Configurações" },
] as const;
export type PermissionKey = (typeof PERMISSIONS)[number]["key"];

export const meQuery = queryOptions({
  queryKey: ["me"],
  queryFn: async () => {
    const { data: auth } = await supabase.auth.getUser();
    const user = auth.user;
    if (!user) return null;
    const [{ data: profile }, { data: roles }, { data: perms }] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", user.id),
      supabase.from("role_permissions").select("*"),
    ]);
    const roleList = (roles ?? []).map((r) => r.role as Role);
    const isSuper = roleList.includes("superadmin");
    const permSet = new Set(
      (perms ?? []).filter((p) => roleList.includes(p.role as Role)).map((p) => p.permission),
    );
    return {
      id: user.id,
      profile,
      roles: roleList,
      isSuper,
      can: (p: PermissionKey) => isSuper || permSet.has(p),
    };
  },
});

export function useMe() {
  return useQuery(meQuery);
}

export function initials(name?: string | null) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}
