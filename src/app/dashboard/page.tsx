import { StatsCards } from "@/components/dashboard/stats-cards";
import { CustomersTable } from "@/components/dashboard/customers-table";
import { getDashboardStats, getCustomers } from "@/actions/import-data";
import { Button } from "@/components/ui/button";
import { Upload } from "lucide-react";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [stats, customers] = await Promise.all([
    getDashboardStats(),
    getCustomers(),
  ]);

  return (
    <div className="container mx-auto py-8 px-4 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">
            Gerencie o cashback dos clientes da agencia
          </p>
        </div>
        <Link href="/import">
          <Button>
            <Upload className="h-4 w-4 mr-2" />
            Importar Dados
          </Button>
        </Link>
      </div>

      <StatsCards
        totalPoints={stats.totalPoints}
        activeCustomers={stats.activeCustomers}
        completedTrips={stats.completedTrips}
      />

      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Clientes</h2>
        <CustomersTable initialCustomers={customers} />
      </div>
    </div>
  );
}
