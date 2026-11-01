import { createFileRoute, Link, Outlet, redirect, useNavigate } from "@tanstack/react-router";
import { LogOut, Newspaper, Settings } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { initials, ROLE_LABEL, useMe } from "@/lib/session";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth" });
  },
  component: AppLayout,
});

function AppLayout() {
  const { data: me } = useMe();
  const navigate = useNavigate();
  const { data: company } = useQuery({
    queryKey: ["company"],
    queryFn: async () => (await supabase.from("company").select("*").eq("id", 1).maybeSingle()).data,
  });
  const showSettings = me && (me.can("company.manage") || me.can("collaborators.manage") || me.isSuper);

  const nav = "flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-sidebar-foreground transition-colors hover:bg-sidebar-accent";
  const active = "bg-sidebar-accent text-primary shadow-soft";

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b bg-card/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-4">
          <Link to="/timeline" className="flex items-center gap-2 font-semibold text-foreground">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-primary text-primary-foreground">A</span>
            <span className="hidden sm:block">{company?.trade_name || company?.name || "Aurora"}</span>
          </Link>
          <nav className="flex items-center gap-1">
            <Link to="/timeline" className={nav} activeProps={{ className: active }}>
              <Newspaper className="h-4 w-4" /> Timeline
            </Link>
            {showSettings && (
              <Link to="/configuracoes" className={nav} activeProps={{ className: active }}>
                <Settings className="h-4 w-4" /> Configurações
              </Link>
            )}
          </nav>
          <div className="ml-auto flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-semibold text-foreground">{me?.profile?.full_name}</p>
              <p className="text-xs text-muted-foreground">{me?.roles[0] ? ROLE_LABEL[me.roles[0]] : ""}</p>
            </div>
            <Avatar>
              <AvatarFallback className="bg-primary-soft text-primary">{initials(me?.profile?.full_name)}</AvatarFallback>
            </Avatar>
            <button
              aria-label="Sair"
              onClick={async () => {
                await supabase.auth.signOut();
                navigate({ to: "/auth" });
              }}
              className="rounded-full p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">
        <Outlet />
      </main>
    </div>
  );
}
