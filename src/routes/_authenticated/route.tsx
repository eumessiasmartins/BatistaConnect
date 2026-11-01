import { createFileRoute, Link, Outlet, redirect, useNavigate } from "@tanstack/react-router";
import { LogOut, Newspaper, Settings, Sun, Moon } from "lucide-react";
import { useState, useEffect } from "react";
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

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";

function AppLayout() {
  const { data: me } = useMe();
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const checkTheme = () => {
      const isDarkMode = document.documentElement.classList.contains("dark");
      setIsDark(isDarkMode);
    };
    checkTheme();
    
    // Observer to keep in sync if changed elsewhere
    const observer = new MutationObserver(checkTheme);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  const toggleTheme = () => {
    const next = !isDark;
    setIsDark(next);
    if (next) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  };
  const navigate = useNavigate();
  const { data: company } = useQuery({
    queryKey: ["company"],
    queryFn: async () => (await supabase.from("company").select("*").eq("id", 1).maybeSingle()).data,
  });
  const showSettings = me && (me.can("company.manage") || me.can("collaborators.manage") || me.isSuper);

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <Sidebar collapsible="icon">
          <SidebarHeader className="border-b border-sidebar-border px-4 py-3">
            <Link to="/timeline" className="flex items-center gap-2 font-semibold text-sidebar-foreground">
              <span className="grid h-8 w-8 place-items-center rounded-xl bg-gradient-primary text-primary-foreground">
                A
              </span>
              <span className="truncate text-sm font-bold">{company?.trade_name || company?.name || "Aurora"}</span>
            </Link>
          </SidebarHeader>
          <SidebarContent className="px-2 py-4">
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild tooltip="Timeline">
                  <Link to="/timeline" activeProps={{ className: "bg-sidebar-accent font-medium text-primary" }}>
                    <Newspaper className="h-4 w-4" />
                    <span>Timeline</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              {showSettings && (
                <SidebarMenuItem>
                  <SidebarMenuButton asChild tooltip="Configurações">
                    <Link to="/configuracoes" activeProps={{ className: "bg-sidebar-accent font-medium text-primary" }}>
                      <Settings className="h-4 w-4" />
                      <span>Configurações</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
            </SidebarMenu>
          </SidebarContent>
          <SidebarFooter className="border-t border-sidebar-border p-3">
            <div className="flex items-center gap-3 overflow-hidden rounded-xl p-2">
              <Avatar className="h-9 w-9 shrink-0">
                <AvatarFallback className="bg-primary-soft text-primary">{initials(me?.profile?.full_name)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
                <p className="truncate text-xs font-semibold text-sidebar-foreground">{me?.profile?.full_name}</p>
                <p className="truncate text-[10px] text-muted-foreground">{me?.roles[0] ? ROLE_LABEL[me.roles[0]] : ""}</p>
              </div>
              <button
                aria-label="Sair"
                onClick={async () => {
                  await supabase.auth.signOut();
                  navigate({ to: "/auth" });
                }}
                className="shrink-0 rounded-lg p-2 text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground group-data-[collapsible=icon]:hidden"
                title="Sair"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </SidebarFooter>
        </Sidebar>
        <SidebarInset className="flex-1 flex flex-col min-w-0">
          <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b bg-card/80 px-6 backdrop-blur">
            <SidebarTrigger />
            <div className="ml-auto flex items-center gap-3">
              <button
                onClick={toggleTheme}
                aria-label="Alternar tema"
                className="rounded-full p-2 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                title={isDark ? "Mudar para modo claro" : "Mudar para modo escuro"}
              >
                {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </button>
              <Avatar className="h-8 w-8 sm:hidden">
                <AvatarFallback className="bg-primary-soft text-primary">{initials(me?.profile?.full_name)}</AvatarFallback>
              </Avatar>
              <button
                aria-label="Sair"
                onClick={async () => {
                  await supabase.auth.signOut();
                  navigate({ to: "/auth" });
                }}
                className="rounded-full p-2 text-muted-foreground hover:bg-muted hover:text-foreground sm:hidden"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </header>
          <main className="flex-1 p-6 max-w-6xl w-full mx-auto">
            <Outlet />
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
