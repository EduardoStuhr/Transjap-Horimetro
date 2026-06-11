import { createFileRoute, Outlet, Link, useRouter } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Gauge, History, Settings, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMyRole } from "@/lib/horimeter.functions";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    return { user: data.session?.user ?? null };
  },
  component: AuthedLayout,
});

function AuthedLayout() {
  const { user } = Route.useRouteContext();
  const router = useRouter();
  const qc = useQueryClient();
  const fetchRole = useServerFn(getMyRole);
  const { data: roleData } = useQuery({
    queryKey: ["me", "role"],
    queryFn: () => fetchRole(),
    enabled: Boolean(user),
  });

  async function logout() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    router.navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="border-b border-border bg-card/60 backdrop-blur sticky top-0 z-30">
        <div className="mx-auto max-w-3xl px-4 h-14 flex items-center gap-3">
          <Link to="/" className="flex items-center gap-2 font-semibold">
            <span className="size-7 rounded-md bg-primary text-primary-foreground flex items-center justify-center">
              <Gauge className="size-4" />
            </span>
            <span>Horímetro</span>
          </Link>
          <div className="ml-auto flex items-center gap-1">
            <Button asChild variant="ghost" size="sm">
              <Link to="/history"><History className="size-4 mr-1" />Histórico</Link>
            </Button>
            {roleData?.isAdmin && (
              <Button asChild variant="ghost" size="sm">
                <Link to="/admin"><Settings className="size-4 mr-1" />Admin</Link>
              </Button>
            )}
            {user && (
              <Button variant="ghost" size="icon" onClick={logout} title="Sair">
                <LogOut className="size-4" />
              </Button>
            )}
          </div>
        </div>
        <div className="mx-auto max-w-3xl px-4 pb-2 text-xs text-muted-foreground truncate">
          {user?.email ?? "Acesso sem login"}
        </div>
      </header>
      <main className="flex-1 mx-auto w-full max-w-3xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
