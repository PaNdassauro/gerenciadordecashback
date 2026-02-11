import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatPoints, formatCurrency } from "@/lib/utils";
import { Coins, Users, Plane, DollarSign } from "lucide-react";

interface StatsCardsProps {
  totalPoints: number;
  activeCustomers: number;
  completedTrips: number;
  totalRevenue1Percent: number;
}

export function StatsCards({
  totalPoints,
  activeCustomers,
  completedTrips,
  totalRevenue1Percent,
}: StatsCardsProps) {
  return (
    <div className="grid gap-4 md:grid-cols-4">
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

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Receita 1%</CardTitle>
          <DollarSign className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {formatCurrency(totalRevenue1Percent)}
          </div>
          <p className="text-xs text-muted-foreground">
            comissao total sobre vendas
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
