import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow, format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import {
  CalendarDays, CheckCircle2, Clock, Download, FileText, Heart, MapPin, MessageCircle, MoreHorizontal, Send, Trash2, Video,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { initials, useMe } from "@/lib/session";
import { TYPE_META, type FeedPost, type PostType } from "./types";

const BADGE: Record<PostType, string> = {
  post: "bg-type-post/15 text-type-post",
  announcement: "bg-type-announcement/15 text-type-announcement",
  event: "bg-type-event/15 text-type-event",
  poll: "bg-type-poll/15 text-type-poll",
};

export function PostCard({ post }: { post: FeedPost }) {
  const { data: me } = useMe();
  const qc = useQueryClient();
  const [showComments, setShowComments] = useState(false);
  const [comment, setComment] = useState("");
  const refresh = () => qc.invalidateQueries({ queryKey: ["feed"] });
  const type = post.type as PostType;
  const uid = me?.id;
  const liked = post.post_likes.some((l) => l.user_id === uid);
  const myVote = post.poll_votes.find((v) => v.user_id === uid)?.option_id;
  const confirmed = post.read_confirmations.some((r) => r.user_id === uid);
  const images = post.post_attachments.filter((a) => a.kind === "image");
  const docs = post.post_attachments.filter((a) => a.kind === "document");
  const canDelete = uid === post.author_id || me?.can("posts.moderate");

  const run = async (p: PromiseLike<{ error: any }>) => {
    const { error } = await p;
    if (error) toast.error(error.message);
    refresh();
  };

  const toggleLike = () =>
    run(liked ? supabase.from("post_likes").delete().eq("post_id", post.id).eq("user_id", uid!) : supabase.from("post_likes").insert({ post_id: post.id }));

  const vote = async (optionId: string) => {
    if (myVote === optionId) return run(supabase.from("poll_votes").delete().eq("post_id", post.id).eq("user_id", uid!));
    if (myVote) await supabase.from("poll_votes").delete().eq("post_id", post.id).eq("user_id", uid!);
    run(supabase.from("poll_votes").insert({ post_id: post.id, option_id: optionId }));
  };

  const sendComment = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = comment.trim();
    if (!text) return;
    setComment("");
    run(supabase.from("post_comments").insert({ post_id: post.id, content: text.slice(0, 2000) }));
  };

  const del = async () => {
    if (!confirm("Excluir esta publicação?")) return;
    const paths = post.post_attachments.map((a) => a.path);
    await run(supabase.from("posts").delete().eq("id", post.id));
    if (paths.length && uid === post.author_id) await supabase.storage.from("attachments").remove(paths);
  };

  const totalVotes = post.poll_votes.length;

  return (
    <article className="animate-rise overflow-hidden rounded-3xl border bg-card shadow-soft">
      <header className="flex items-center gap-3 px-5 pt-5">
        <Avatar><AvatarFallback className="bg-primary-soft text-primary">{initials(post.author?.full_name)}</AvatarFallback></Avatar>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-foreground">{post.author?.full_name}</p>
          <p className="text-xs text-muted-foreground">
            {post.author?.job_title ? `${post.author.job_title} · ` : ""}
            {formatDistanceToNow(new Date(post.created_at), { addSuffix: true, locale: ptBR })}
          </p>
        </div>
        <span className={cn("rounded-full px-3 py-1 text-xs font-semibold", BADGE[type])}>{TYPE_META[type].label}</span>
        {canDelete && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" aria-label="Opções"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={del} className="text-destructive"><Trash2 className="h-4 w-4" /> Excluir</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </header>

      <div className="space-y-4 px-5 py-4">
        {post.title && type !== "event" && <h3 className="text-xl text-foreground">{post.title}</h3>}

        {type === "event" && (
          <div className="flex gap-4 rounded-2xl bg-sky p-4">
            {post.event_date && (
              <div className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-card text-center shadow-soft">
                <div>
                  <p className="text-xs uppercase text-primary">{format(parseISO(post.event_date), "MMM", { locale: ptBR })}</p>
                  <p className="font-display text-2xl leading-none text-foreground">{format(parseISO(post.event_date), "dd")}</p>
                </div>
              </div>
            )}
            <div className="min-w-0 space-y-1 text-sm">
              <h3 className="text-xl text-foreground">{post.title}</h3>
              {post.event_date && (
                <p className="flex items-center gap-1.5 text-muted-foreground"><CalendarDays className="h-4 w-4" />
                  {format(parseISO(post.event_date), "EEEE, d 'de' MMMM 'de' yyyy", { locale: ptBR })}</p>
              )}
              <p className="flex items-center gap-1.5 text-muted-foreground"><Clock className="h-4 w-4" />
                {post.event_start?.slice(0, 5)} – {post.event_end?.slice(0, 5)}</p>
              {post.event_format === "local" ? (
                <p className="flex items-center gap-1.5 text-muted-foreground"><MapPin className="h-4 w-4" />{post.event_location}</p>
              ) : (
                <a href={post.event_link ?? "#"} target="_blank" rel="noreferrer"
                  className="flex items-center gap-1.5 font-medium text-primary hover:underline"><Video className="h-4 w-4" /> Entrar no evento online</a>
              )}
            </div>
          </div>
        )}

        {post.content && <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-foreground">{post.content}</p>}

        {images.length > 0 && (
          <div className={cn("grid gap-2 overflow-hidden rounded-2xl", images.length > 1 && "grid-cols-2")}>
            {images.slice(0, 4).map((img, i) => (
              <a key={img.id} href={img.url} target="_blank" rel="noreferrer" className="relative block">
                <img src={img.url} alt={img.name} loading="lazy"
                  className={cn("w-full object-cover", images.length === 1 ? "max-h-[520px]" : "aspect-square")} />
                {i === 3 && images.length > 4 && (
                  <span className="absolute inset-0 grid place-items-center bg-foreground/50 text-2xl font-semibold text-background">+{images.length - 4}</span>
                )}
              </a>
            ))}
          </div>
        )}

        {docs.length > 0 && (
          <div className="space-y-2">
            {docs.map((d) => (
              <a key={d.id} href={d.url} target="_blank" rel="noreferrer" download={d.name}
                className="flex items-center gap-3 rounded-2xl border bg-muted px-4 py-3 text-sm transition-colors hover:bg-accent">
                <FileText className="h-5 w-5 text-primary" />
                <span className="min-w-0 flex-1 truncate text-foreground">{d.name}</span>
                <Download className="h-4 w-4 text-muted-foreground" />
              </a>
            ))}
          </div>
        )}

        {type === "poll" && (
          <div className="space-y-2">
            {post.poll_options.map((o) => {
              const count = post.poll_votes.filter((v) => v.option_id === o.id).length;
              const pct = totalVotes ? Math.round((count / totalVotes) * 100) : 0;
              const mine = myVote === o.id;
              return (
                <button key={o.id} onClick={() => vote(o.id)}
                  className={cn("relative w-full overflow-hidden rounded-xl border px-4 py-3 text-left text-sm transition-colors",
                    mine ? "border-primary" : "hover:border-ring")}>
                  <span className={cn("absolute inset-y-0 left-0 transition-all", mine ? "bg-primary-soft" : "bg-muted")} style={{ width: `${myVote ? pct : 0}%` }} />
                  <span className="relative flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2 font-medium text-foreground">
                      {mine && <CheckCircle2 className="h-4 w-4 text-primary" />}{o.label}
                    </span>
                    {myVote && <span className="text-muted-foreground">{pct}%</span>}
                  </span>
                </button>
              );
            })}
            <p className="text-xs text-muted-foreground">{totalVotes} {totalVotes === 1 ? "voto" : "votos"}{!myVote && " · vote para ver o resultado"}</p>
          </div>
        )}

        {post.require_read_confirmation && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-primary-soft px-4 py-3">
            {confirmed ? (
              <span className="flex items-center gap-2 text-sm font-medium text-success"><CheckCircle2 className="h-4 w-4" /> Leitura confirmada</span>
            ) : (
              <Button size="sm" className="rounded-full" onClick={() => run(supabase.from("read_confirmations").insert({ post_id: post.id }))}>
                <CheckCircle2 className="h-4 w-4" /> Confirmar leitura
              </Button>
            )}
            <Popover>
              <PopoverTrigger className="text-xs font-medium text-primary hover:underline">
                {post.read_confirmations.length} confirmaç{post.read_confirmations.length === 1 ? "ão" : "ões"}
              </PopoverTrigger>
              <PopoverContent className="max-h-64 w-64 overflow-auto">
                {post.read_confirmations.length === 0 ? <p className="text-sm text-muted-foreground">Ninguém confirmou ainda.</p> :
                  post.read_confirmations.map((r) => (
                    <div key={r.user_id} className="flex justify-between py-1 text-sm">
                      <span className="truncate">{r.profile?.full_name}</span>
                      <span className="text-xs text-muted-foreground">{format(new Date(r.confirmed_at), "dd/MM HH:mm")}</span>
                    </div>
                  ))}
              </PopoverContent>
            </Popover>
          </div>
        )}
      </div>

      <footer className="border-t px-3 py-2">
        <div className="flex gap-1">
          <Button variant="ghost" size="sm" onClick={toggleLike} className={cn(liked && "text-destructive")}>
            <Heart className={cn("h-4 w-4", liked && "fill-current")} /> {post.post_likes.length || ""} Curtir
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setShowComments((s) => !s)}>
            <MessageCircle className="h-4 w-4" /> {post.post_comments.length || ""} Comentar
          </Button>
        </div>
        {showComments && (
          <div className="space-y-3 px-2 pb-2 pt-3">
            {post.post_comments.map((c) => (
              <div key={c.id} className="flex gap-2">
                <Avatar className="h-8 w-8"><AvatarFallback className="bg-secondary text-xs text-secondary-foreground">{initials(c.author?.full_name)}</AvatarFallback></Avatar>
                <div className="group min-w-0 flex-1 rounded-2xl bg-muted px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold text-foreground">{c.author?.full_name}</p>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-muted-foreground">{formatDistanceToNow(new Date(c.created_at), { locale: ptBR })}</span>
                      {(c.author_id === uid || me?.can("posts.moderate")) && (
                        <button aria-label="Excluir comentário" onClick={() => run(supabase.from("post_comments").delete().eq("id", c.id))}
                          className="opacity-0 transition-opacity group-hover:opacity-100"><Trash2 className="h-3 w-3 text-muted-foreground" /></button>
                      )}
                    </div>
                  </div>
                  <p className="whitespace-pre-wrap text-sm text-foreground">{c.content}</p>
                </div>
              </div>
            ))}
            <form onSubmit={sendComment} className="flex gap-2">
              <Input value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Escreva um comentário..." className="rounded-full" />
              <Button type="submit" size="icon" className="rounded-full" aria-label="Enviar"><Send className="h-4 w-4" /></Button>
            </form>
          </div>
        )}
      </footer>
    </article>
  );
}
