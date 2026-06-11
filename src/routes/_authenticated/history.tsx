import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Clock, Gauge } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { listMyReadings } from "@/lib/horimeter.functions";

export const Route = createFileRoute("/_authenticated/history")({
  component: HistoryPage,
});

function HistoryPage() {
  const fetchReadings = useServerFn(listMyReadings);
  const { data, isLoading } = useQuery({
    queryKey: ["readings", "history"],
    queryFn: () => fetchReadings({ data: { limit: 50 } }),
  });

  return (
    <div className="space-y-5">
      <div>
        <Button asChild variant="ghost" size="sm" className="mb-2">
          <Link to="/"><ArrowLeft className="size-4 mr-2" />Voltar</Link>
        </Button>
        <h1 className="text-2xl font-bold">Histórico</h1>
        <p className="text-sm text-muted-foreground">Últimas leituras registradas neste modo de operação.</p>
      </div>

      {isLoading && <div className="text-sm text-muted-foreground">Carregando...</div>}
      {!isLoading && (data?.readings.length ?? 0) === 0 && (
        <Card className="p-4 text-sm text-muted-foreground">Nenhuma leitura salva ainda.</Card>
      )}
      <div className="space-y-3">
        {data?.readings.map((reading: any) => (
          <Card key={reading.id} className="p-4">
            <div className="flex items-start gap-3">
              <div className="size-10 rounded-lg bg-accent flex items-center justify-center">
                <Gauge className="size-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-3">
                  <div className="font-semibold truncate">{reading.machines?.nome ?? "Máquina"}</div>
                  <div className="digit-display text-lg font-bold">{reading.valor_confirmado} h</div>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  <span>{reading.tipo === "fim" ? "Fim" : "Início"}</span>
                  <span>{reading.machines?.codigo}</span>
                  <span className="inline-flex items-center gap-1">
                    <Clock className="size-3" /> {new Date(reading.created_at).toLocaleString("pt-BR")}
                  </span>
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
