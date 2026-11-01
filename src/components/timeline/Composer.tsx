import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  BarChart3, CalendarDays, FileText, ImagePlus, Loader2, Megaphone, MapPin, Paperclip, Plus, Video, X, Image as ImageIcon,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { useMe } from "@/lib/session";
import { TYPE_META, type PostType } from "./types";

const ICONS: Record<PostType, typeof ImageIcon> = {
  post: ImageIcon, announcement: Megaphone, event: CalendarDays, poll: BarChart3,
};

const DOC_ACCEPT = ".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.odt,.ods";

export function Composer() {
  const { data: me } = useMe();
  const qc = useQueryClient();
  const allowed = (Object.keys(TYPE_META) as PostType[]).filter((t) => me?.can(TYPE_META[t].perm));
  const [type, setType] = useState<PostType>("post");
  const [content, setContent] = useState("");
  const [title, setTitle] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [readConfirm, setReadConfirm] = useState(false);
  const [ev, setEv] = useState({ date: "", start: "", end: "", format: "local" as "local" | "online", location: "", link: "" });
  const [options, setOptions] = useState(["", ""]);
  const [saving, setSaving] = useState(false);
  const imgRef = useRef<HTMLInputElement>(null);
  const docRef = useRef<HTMLInputElement>(null);

  if (!me || allowed.length === 0) return null;
  const current = allowed.includes(type) ? type : allowed[0];

  const reset = () => {
    setContent(""); setTitle(""); setFiles([]); setReadConfirm(false);
    setEv({ date: "", start: "", end: "", format: "local", location: "", link: "" }); setOptions(["", ""]);
  };

  const addFiles = (list: FileList | null, kind: "image" | "document") => {
    if (!list) return;
    const arr = Array.from(list).filter((f) => (kind === "image" ? f.type.startsWith("image/") : true));
    if (arr.some((f) => f.size > 20 * 1024 * 1024)) toast.error("Arquivos devem ter até 20MB.");
    const ok = arr.filter((f) => f.size <= 20 * 1024 * 1024);
    setFiles((prev) => (current === "event" ? ok.slice(0, 1) : [...prev, ...ok]));
  };

  async function submit() {
    if (!me) return;
    const opts = options.map((o) => o.trim()).filter(Boolean);
    if (current === "post" && files.length === 0 && !content.trim()) return toast.error("Adicione imagens ou uma legenda.");
    if (current === "announcement" && !title.trim()) return toast.error("Informe o título do comunicado.");
    if (current === "event") {
      if (!title.trim() || !ev.date || !ev.start || !ev.end) return toast.error("Preencha nome, data e horários do evento.");
      if (ev.end <= ev.start) return toast.error("O horário de término deve ser após o início.");
      if (ev.format === "local" && !ev.location.trim()) return toast.error("Informe o local do evento.");
      if (ev.format === "online" && !/^https?:\/\//i.test(ev.link.trim())) return toast.error("Informe um link válido (https://...).");
    }
    if (current === "poll") {
      if (!title.trim()) return toast.error("Informe a pergunta da enquete.");
      if (opts.length < 2) return toast.error("A enquete precisa de pelo menos 2 opções.");
    }
    setSaving(true);
    try {
      const { data: post, error } = await supabase
        .from("posts")
        .insert({
          author_id: me.id,
          type: current,
          title: current === "post" ? null : title.trim(),
          content: content.trim() || null,
          require_read_confirmation: current === "announcement" && readConfirm,
          ...(current === "event"
            ? {
                event_date: ev.date, event_start: ev.start, event_end: ev.end, event_format: ev.format,
                event_location: ev.format === "local" ? ev.location.trim() : null,
                event_link: ev.format === "online" ? ev.link.trim() : null,
              }
            : {}),
        })
        .select("id")
        .single();
      if (error) throw error;

      const usable = current === "poll" ? [] : files;
      for (const f of usable) {
        const path = `${me.id}/${post.id}/${crypto.randomUUID()}-${f.name.replace(/[^\w.\-]/g, "_")}`;
        const { error: upErr } = await supabase.storage.from("attachments").upload(path, f, { contentType: f.type });
        if (upErr) throw upErr;
        await supabase.from("post_attachments").insert({
          post_id: post.id, path, name: f.name, mime: f.type, size: f.size,
          kind: f.type.startsWith("image/") ? "image" : "document",
        });
      }
      if (current === "poll") {
        await supabase.from("poll_options").insert(opts.map((label, position) => ({ post_id: post.id, label, position })));
      }
      toast.success("Publicado!");
      reset();
      qc.invalidateQueries({ queryKey: ["feed"] });
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao publicar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="animate-rise rounded-3xl border bg-card p-5 shadow-soft">
      <div className="flex flex-wrap gap-2">
        {allowed.map((t) => {
          const Icon = ICONS[t];
          return (
            <button key={t} onClick={() => { setType(t); setFiles([]); }}
              className={cn(
                "flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-all",
                current === t ? "bg-primary text-primary-foreground shadow-soft" : "bg-secondary text-secondary-foreground hover:bg-accent",
              )}>
              <Icon className="h-4 w-4" /> {TYPE_META[t].label}
            </button>
          );
        })}
      </div>

      <div className="mt-5 space-y-4">
        {current !== "post" && (
          <Input value={title} onChange={(e) => setTitle(e.target.value)} className="h-11 text-base"
            placeholder={current === "announcement" ? "Título do comunicado" : current === "event" ? "Nome do evento" : "Pergunta da enquete"} />
        )}
        <Textarea value={content} onChange={(e) => setContent(e.target.value)} rows={3} className="resize-none"
          placeholder={current === "post" ? "Escreva uma legenda para suas imagens..." : current === "poll" ? "Descrição (opcional)" : current === "event" ? "Descrição do evento (opcional)" : "Escreva o comunicado..."} />

        {current === "event" && (
          <div className="grid gap-4 rounded-2xl bg-muted p-4 sm:grid-cols-3">
            <div className="space-y-1.5"><Label>Data</Label><Input type="date" value={ev.date} onChange={(e) => setEv({ ...ev, date: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Início</Label><Input type="time" value={ev.start} onChange={(e) => setEv({ ...ev, start: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Término</Label><Input type="time" value={ev.end} onChange={(e) => setEv({ ...ev, end: e.target.value })} /></div>
            <div className="sm:col-span-3 space-y-2">
              <Label>Formato</Label>
              <div className="flex gap-2">
                {(["local", "online"] as const).map((f) => (
                  <button key={f} type="button" onClick={() => setEv({ ...ev, format: f })}
                    className={cn("flex items-center gap-2 rounded-xl border px-4 py-2 text-sm",
                      ev.format === f ? "border-primary bg-primary-soft text-primary" : "bg-card text-muted-foreground")}>
                    {f === "local" ? <MapPin className="h-4 w-4" /> : <Video className="h-4 w-4" />}
                    {f === "local" ? "Local" : "Online"}
                  </button>
                ))}
              </div>
              {ev.format === "local" ? (
                <Input placeholder="Endereço ou sala do evento" value={ev.location} onChange={(e) => setEv({ ...ev, location: e.target.value })} />
              ) : (
                <Input placeholder="https://meet.exemplo.com/..." value={ev.link} onChange={(e) => setEv({ ...ev, link: e.target.value })} />
              )}
            </div>
          </div>
        )}

        {current === "poll" && (
          <div className="space-y-2 rounded-2xl bg-muted p-4">
            <Label>Opções</Label>
            {options.map((o, i) => (
              <div key={i} className="flex gap-2">
                <Input value={o} placeholder={`Opção ${i + 1}`} onChange={(e) => setOptions(options.map((x, j) => (j === i ? e.target.value : x)))} />
                {options.length > 2 && (
                  <Button variant="ghost" size="icon" onClick={() => setOptions(options.filter((_, j) => j !== i))}><X className="h-4 w-4" /></Button>
                )}
              </div>
            ))}
            {options.length < 10 && (
              <Button variant="ghost" size="sm" onClick={() => setOptions([...options, ""])}><Plus className="h-4 w-4" /> Adicionar opção</Button>
            )}
          </div>
        )}

        {current === "announcement" && (
          <label className="flex items-center justify-between rounded-2xl bg-muted px-4 py-3">
            <span className="text-sm">
              <span className="font-medium text-foreground">Confirmação de leitura</span>
              <span className="block text-xs text-muted-foreground">Colaboradores precisarão confirmar que leram.</span>
            </span>
            <Switch checked={readConfirm} onCheckedChange={setReadConfirm} />
          </label>
        )}

        {files.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {files.map((f, i) => (
              <div key={i} className="group relative">
                {f.type.startsWith("image/") ? (
                  <img src={URL.createObjectURL(f)} alt={f.name} className="h-20 w-20 rounded-xl object-cover" />
                ) : (
                  <div className="flex h-20 w-40 items-center gap-2 rounded-xl bg-secondary px-3 text-xs text-secondary-foreground">
                    <FileText className="h-5 w-5 shrink-0" /><span className="line-clamp-2">{f.name}</span>
                  </div>
                )}
                <button onClick={() => setFiles(files.filter((_, j) => j !== i))}
                  className="absolute -right-1.5 -top-1.5 rounded-full bg-foreground p-0.5 text-background"><X className="h-3 w-3" /></button>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between border-t pt-4">
          <div className="flex gap-1">
            {current !== "poll" && (
              <>
                <input ref={imgRef} type="file" accept="image/*" multiple={current !== "event"} hidden
                  onChange={(e) => { addFiles(e.target.files, "image"); e.target.value = ""; }} />
                <Button variant="ghost" size="sm" onClick={() => imgRef.current?.click()}>
                  <ImagePlus className="h-4 w-4" /> {current === "event" ? "Imagem" : "Imagens"}
                </Button>
              </>
            )}
            {current === "announcement" && (
              <>
                <input ref={docRef} type="file" accept={DOC_ACCEPT} multiple hidden
                  onChange={(e) => { addFiles(e.target.files, "document"); e.target.value = ""; }} />
                <Button variant="ghost" size="sm" onClick={() => docRef.current?.click()}><Paperclip className="h-4 w-4" /> Documentos</Button>
              </>
            )}
          </div>
          <Button onClick={submit} disabled={saving} className="rounded-full px-6">
            {saving && <Loader2 className="h-4 w-4 animate-spin" />} Publicar
          </Button>
        </div>
      </div>
    </div>
  );
}
