import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Composer } from "@/components/timeline/Composer";
import { PostCard } from "@/components/timeline/PostCard";
import { feedQuery, TYPE_META, type PostType } from "@/components/timeline/types";
import { useMe } from "@/lib/session";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/timeline")({
  head: () => ({
    meta: [
      { title: "Timeline — Aurora" },
      { name: "description", content: "Postagens, comunicados, eventos e enquetes da empresa." },
      { property: "og:title", content: "Timeline — Aurora" },
      { property: "og:description", content: "Postagens, comunicados, eventos e enquetes da empresa." },
    ],
  }),
  component: Timeline,
});

function Timeline() {
  const { data: me } = useMe();
  const { data: posts, isLoading } = useQuery(feedQuery);
  const [filter, setFilter] = useState<PostType | "all">("all");
  const list = (posts ?? []).filter((p) => filter === "all" || p.type === filter);
  const upcoming = (posts ?? [])
    .filter((p) => p.type === "event" && p.event_date && p.event_date >= new Date().toISOString().slice(0, 10))
    .sort((a, b) => (a.event_date! < b.event_date! ? -1 : 1))
    .slice(0, 4);

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_300px]">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl text-foreground">Olá, {me?.profile?.full_name?.split(" ")[0]}</h1>
          <p className="text-sm text-muted-foreground">Veja o que está acontecendo na empresa.</p>
        </div>
        <Composer />
        <div className="flex flex-wrap gap-2">
          {(["all", "post", "announcement", "event", "poll"] as const).map((f) => (
            <button key={f} onClick={() => setFilter(f)}
              className={cn("rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                filter === f ? "bg-foreground text-background" : "text-muted-foreground hover:bg-muted")}>
              {f === "all" ? "Tudo" : TYPE_META[f].label}
            </button>
          ))}
        </div>
        {isLoading ? (
          <div className="grid place-items-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : list.length === 0 ? (
          <div className="rounded-3xl border border-dashed bg-card p-12 text-center text-sm text-muted-foreground">Nenhuma publicação ainda.</div>
        ) : (
          list.map((p) => <PostCard key={p.id} post={p} />)
        )}
      </div>
      <aside className="hidden space-y-4 lg:block">
        <div className="sticky top-24 rounded-3xl bg-sky p-5">
          <h2 className="text-lg text-foreground">Próximos eventos</h2>
          <div className="mt-3 space-y-3">
            {upcoming.length === 0 && <p className="text-sm text-muted-foreground">Nenhum evento agendado.</p>}
            {upcoming.map((e) => (
              <div key={e.id} className="rounded-2xl bg-card p-3 shadow-soft">
                <p className="text-sm font-semibold text-foreground">{e.title}</p>
                <p className="text-xs text-muted-foreground">
                  {e.event_date!.split("-").reverse().join("/")} · {e.event_start?.slice(0, 5)}
                </p>
              </div>
            ))}
          </div>
        </div>
      </aside>
    </div>
  );
}
