import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listMyOpenShifts } from "@/lib/horimeter.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScanLine, Clock, Truck } from "lucide-react";

export const Route = createFileRoute("/_authenticated/")({
  component: Home,
});

function Home() {
  const fetchOpen = useServerFn(listMyOpenShifts);
  const { data, isLoading } = useQuery({
    queryKey: ["shifts", "open"],
    queryFn: () => fetchOpen(),
  });

  return (
    <div className="space-y-6">
      <Link to="/capture" search={{ tipo: "inicio" }}>
        <Card className="p-6 hover:bg-accent/60 transition cursor-pointer border-primary/30">
          <div className="flex items-center gap-4">
            <div className="size-14 rounded-xl bg-primary text-primary-foreground flex items-center justify-center">
              <ScanLine className="size-7" />
            </div>
            <div>
              <div className="text-lg font-semibold">Iniciar leitura</div>
              <div className="text-sm text-muted-foreground">QR + foto + obra</div>
            </div>
          </div>
        </Card>
      </Link>

      <section>
        <h2 className="text-sm uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2">
          <Clock className="size-4" /> Turnos abertos
        </h2>
        {isLoading && <div className="text-sm text-muted-foreground">Carregando…</div>}
        {!isLoading && (data?.shifts.length ?? 0) === 0 && (
          <Card className="p-4 text-sm text-muted-foreground">
            Nenhum turno aberto. Inicie uma leitura quando começar o equipamento.
          </Card>
        )}
        <div className="space-y-3">
          {data?.shifts.map((s: any) => (
            <Card key={s.id} className="p-4">
              <div className="flex items-start gap-3">
                <div className="size-10 rounded-lg bg-accent flex items-center justify-center">
                  <Truck className="size-5" />
                </div>
                <div className="flex-1">
                  <div className="font-semibold">{s.machines?.nome}</div>
                  <div className="text-xs text-muted-foreground">
                    {s.machines?.codigo} · Início: <span className="digit-display">{s.inicio_horimetro}</span> h
                  </div>
                  {s.sites && (
                    <div className="text-xs text-muted-foreground mt-1">Obra: {s.sites.nome}</div>
                  )}
                </div>
                <Button asChild size="sm">
                  <Link to="/capture" search={{ tipo: "fim", machineId: s.machines?.id }}>
                    Finalizar
                  </Link>
                </Button>
              </div>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
