import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Building2, Loader2, Pencil, Plus, ShieldCheck, Users, Camera, Scissors, ZoomIn, Check, RotateCcw } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Slider } from "@/components/ui/slider";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PERMISSIONS, ROLE_LABEL, useMe, type Role } from "@/lib/session";
import { formatCpf } from "@/lib/cpf";
import { createCollaborator, updateCollaborator } from "@/lib/collaborators.functions";

export const Route = createFileRoute("/_authenticated/configuracoes")({
  head: () => ({
    meta: [
      { title: "Configurações — Aurora" },
      { name: "description", content: "Dados da empresa, colaboradores e permissões." },
      { property: "og:title", content: "Configurações — Aurora" },
      { property: "og:description", content: "Dados da empresa, colaboradores e permissões." },
    ],
  }),
  component: Settings,
});

function Settings() {
  const { data: me } = useMe();
  if (!me) return null;
  const tabs = [
    me.can("company.manage") && "empresa",
    me.can("collaborators.manage") && "colaboradores",
    me.isSuper && "permissoes",
  ].filter(Boolean) as string[];
  if (!tabs.length) return <p className="text-muted-foreground">Você não tem acesso às configurações.</p>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl text-foreground">Configurações</h1>
        <p className="text-sm text-muted-foreground">Gerencie a empresa, as pessoas e o que cada perfil pode fazer.</p>
      </div>
      <Tabs defaultValue={tabs[0]}>
        <TabsList className="rounded-full bg-secondary p-1">
          {tabs.includes("empresa") && <TabsTrigger value="empresa" className="rounded-full"><Building2 className="h-4 w-4" /> Empresa</TabsTrigger>}
          {tabs.includes("colaboradores") && <TabsTrigger value="colaboradores" className="rounded-full"><Users className="h-4 w-4" /> Colaboradores</TabsTrigger>}
          {tabs.includes("permissoes") && <TabsTrigger value="permissoes" className="rounded-full"><ShieldCheck className="h-4 w-4" /> Permissões</TabsTrigger>}
        </TabsList>
        <TabsContent value="empresa"><CompanyForm /></TabsContent>
        <TabsContent value="colaboradores"><Collaborators /></TabsContent>
        <TabsContent value="permissoes"><Permissions /></TabsContent>
      </Tabs>
    </div>
  );
}

const Panel = ({ children }: { children: React.ReactNode }) => (
  <div className="mt-4 animate-rise rounded-3xl border bg-card p-6 shadow-soft">{children}</div>
);

const COMPANY_FIELDS = [
  ["name", "Razão social"], ["trade_name", "Nome fantasia"], ["cnpj", "CNPJ"], ["email", "E-mail"],
  ["phone", "Telefone"], ["website", "Site"], ["address", "Endereço"], ["city", "Cidade"], ["state", "Estado"],
] as const;

function CompanyForm() {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["company"],
    queryFn: async () => (await supabase.from("company").select("*").eq("id", 1).maybeSingle()).data,
  });
  const [form, setForm] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (data) setForm(Object.fromEntries(COMPANY_FIELDS.map(([k]) => [k, (data as any)[k] ?? ""])));
  }, [data]);

  const save = async () => {
    if (!form.name?.trim()) return toast.error("Razão social é obrigatória.");
    setSaving(true);
    const payload = Object.fromEntries(Object.entries(form).map(([k, v]) => [k, v.trim() || null]));
    const { error } = await supabase.from("company").upsert({ id: 1, ...payload, name: form.name.trim(), updated_at: new Date().toISOString() });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Dados da empresa salvos.");
    qc.invalidateQueries({ queryKey: ["company"] });
  };

  return (
    <Panel>
      <div className="grid gap-4 sm:grid-cols-2">
        {COMPANY_FIELDS.map(([k, label]) => (
          <div key={k} className={k === "address" ? "space-y-1.5 sm:col-span-2" : "space-y-1.5"}>
            <Label>{label}</Label>
            <Input value={form[k] ?? ""} onChange={(e) => setForm({ ...form, [k]: e.target.value })} />
          </div>
        ))}
      </div>
      <div className="mt-6 flex justify-end">
        <Button onClick={save} disabled={saving} className="rounded-full px-6">{saving && <Loader2 className="h-4 w-4 animate-spin" />} Salvar</Button>
      </div>
    </Panel>
  );
}

type Collab = { id: string; full_name: string; cpf: string; job_title: string | null; department: string | null; phone: string | null; active: boolean; role: Role };

function Collaborators() {
  const { data: me } = useMe();
  const [editing, setEditing] = useState<Collab | "new" | null>(null);
  const [search, setSearch] = useState("");
  const { data, isLoading } = useQuery({
    queryKey: ["collaborators"],
    queryFn: async () => {
      const [{ data: profiles }, { data: roles }] = await Promise.all([
        supabase.from("profiles").select("*").order("full_name"),
        supabase.from("user_roles").select("*"),
      ]);
      return (profiles ?? []).map((p) => ({
        ...p,
        role: (roles?.find((r) => r.user_id === p.id)?.role ?? "user") as Role,
      })) as Collab[];
    },
  });
  const list = (data ?? []).filter((c) => (c.full_name + c.cpf).toLowerCase().includes(search.toLowerCase().replace(/\D/g, "") || search.toLowerCase()));

  return (
    <Panel>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Input placeholder="Buscar por nome ou CPF" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-xs" />
        <Button onClick={() => setEditing("new")} className="rounded-full"><Plus className="h-4 w-4" /> Novo colaborador</Button>
      </div>
      <div className="mt-5 divide-y">
        {isLoading && <Loader2 className="mx-auto my-8 h-5 w-5 animate-spin text-primary" />}
        {list.map((c) => (
          <div key={c.id} className="flex items-center gap-4 py-3">
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium text-foreground">{c.full_name}</p>
              <p className="text-xs text-muted-foreground">{formatCpf(c.cpf)} {c.job_title && `· ${c.job_title}`} {c.department && `· ${c.department}`}</p>
            </div>
            <Badge variant="secondary">{ROLE_LABEL[c.role]}</Badge>
            {!c.active && <Badge variant="outline" className="text-destructive">Inativo</Badge>}
            {(c.role !== "superadmin" || me?.isSuper) && (
              <Button variant="ghost" size="icon" aria-label="Editar" onClick={() => setEditing(c)}><Pencil className="h-4 w-4" /></Button>
            )}
          </div>
        ))}
      </div>
      {editing && <CollabDialog value={editing} onClose={() => setEditing(null)} />}
    </Panel>
  );
}

function CollabDialog({ value, onClose }: { value: Collab | "new"; onClose: () => void }) {
  const isNew = value === "new";
  const { data: me } = useMe();
  const qc = useQueryClient();
  const create = useServerFn(createCollaborator);
  const update = useServerFn(updateCollaborator);
  const [f, setF] = useState({
    full_name: isNew ? "" : value.full_name,
    cpf: isNew ? "" : value.cpf,
    job_title: isNew ? "" : value.job_title ?? "",
    department: isNew ? "" : value.department ?? "",
    phone: isNew ? "" : value.phone ?? "",
    role: (isNew ? "user" : value.role) as Role,
    active: isNew ? true : value.active,
    password: "",
  });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (isNew && f.password.length < 6) return toast.error("A senha deve ter ao menos 6 caracteres.");
    if (!isNew && f.password && f.password.length < 6) return toast.error("A senha deve ter ao menos 6 caracteres.");
    setSaving(true);
    try {
      if (isNew) await create({ data: { ...f } });
      else await update({ data: { id: value.id, ...f } });
      toast.success("Colaborador salvo.");
      qc.invalidateQueries({ queryKey: ["collaborators"] });
      onClose();
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  const roles: Role[] = me?.isSuper ? ["user", "admin", "superadmin"] : ["user", "admin"];
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="rounded-3xl">
        <DialogHeader><DialogTitle>{isNew ? "Novo colaborador" : "Editar colaborador"}</DialogTitle></DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2"><Label>Nome completo</Label><Input value={f.full_name} onChange={(e) => setF({ ...f, full_name: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>CPF</Label><Input disabled={!isNew} value={formatCpf(f.cpf)} onChange={(e) => setF({ ...f, cpf: e.target.value })} placeholder="000.000.000-00" /></div>
          <div className="space-y-1.5"><Label>{isNew ? "Senha" : "Nova senha (opcional)"}</Label><Input type="password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>Cargo</Label><Input value={f.job_title} onChange={(e) => setF({ ...f, job_title: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>Departamento</Label><Input value={f.department} onChange={(e) => setF({ ...f, department: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>Telefone</Label><Input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></div>
          <div className="space-y-1.5">
            <Label>Perfil</Label>
            <Select value={f.role} onValueChange={(v) => setF({ ...f, role: v as Role })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{roles.map((r) => <SelectItem key={r} value={r}>{ROLE_LABEL[r]}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          {!isNew && (
            <label className="flex items-center justify-between rounded-xl bg-muted px-3 py-2 sm:col-span-2">
              <span className="text-sm">Acesso ativo</span>
              <Switch checked={f.active} onCheckedChange={(v) => setF({ ...f, active: v })} />
            </label>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={save} disabled={saving}>{saving && <Loader2 className="h-4 w-4 animate-spin" />} Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Permissions() {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["role_permissions"],
    queryFn: async () => (await supabase.from("role_permissions").select("*")).data ?? [],
  });
  const has = (role: Role, perm: string) => !!data?.some((p) => p.role === role && p.permission === perm);
  const toggle = async (role: Role, perm: string, on: boolean) => {
    const { error } = on
      ? await supabase.from("role_permissions").insert({ role, permission: perm })
      : await supabase.from("role_permissions").delete().eq("role", role).eq("permission", perm);
    if (error) toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["role_permissions"] });
    qc.invalidateQueries({ queryKey: ["me"] });
  };
  const roles: Role[] = ["admin", "user"];

  return (
    <Panel>
      <p className="mb-4 text-sm text-muted-foreground">O Superadmin sempre possui todas as permissões.</p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-muted-foreground">
              <th className="py-2 font-medium">Permissão</th>
              {roles.map((r) => <th key={r} className="py-2 text-center font-medium">{ROLE_LABEL[r]}</th>)}
            </tr>
          </thead>
          <tbody className="divide-y">
            {PERMISSIONS.map((p) => (
              <tr key={p.key}>
                <td className="py-3"><p className="font-medium text-foreground">{p.label}</p><p className="text-xs text-muted-foreground">{p.group}</p></td>
                {roles.map((r) => (
                  <td key={r} className="text-center">
                    <Checkbox checked={has(r, p.key)} onCheckedChange={(v) => toggle(r, p.key, !!v)} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}
