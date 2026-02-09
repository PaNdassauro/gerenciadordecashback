import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatPoints } from "@/lib/utils";
import { Coins, Users, Plane } from "lucide-react";

interface StatsCardsProps {
  totalPoints: number;
  activeCustomers: number;
  completedTrips: number;
}

export function StatsCards({
  totalPoints,
  activeCustomers,
  completedTrips,
}: StatsCardsProps) {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">
            Total de Pontos em Circulacao
          </CardTitle>
          <Coins className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatPoints(totalPoints)}</div>
          <p className="text-xs text-muted-foreground">
            pontos ativos no sistema
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">
            Clientes Ativos
          </CardTitle>
          <Users className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{activeCustomers}</div>
          <p className="text-xs text-muted-foreground">
            clientes com saldo positivo
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">
            Viagens Concluidas
          </CardTitle>
          <Plane className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{completedTrips}</div>
          <p className="text-xs text-muted-foreground">
            viagens finalizadas
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
