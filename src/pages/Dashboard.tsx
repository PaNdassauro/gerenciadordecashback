import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { StatsCards } from "@/components/dashboard/stats-cards";
import { CustomersTable } from "@/components/dashboard/customers-table";
import { Button } from "@/components/ui/button";
import { Upload, Loader2 } from "lucide-react";

interface Stats {
  totalPoints: number;
  activeCustomers: number;
  completedTrips: number;
}

interface Customer {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  cpf: string;
  totalPoints: number;
  createdAt: string;
  updatedAt: string;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      const [statsRes, customersRes] = await Promise.all([
        fetch("/api/stats"),
        fetch("/api/customers"),
      ]);

      const statsData = await statsRes.json();
      const customersData = await customersRes.json();

      setStats(statsData);
      setCustomers(customersData);
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="container mx-auto py-8 px-4 flex items-center justify-center min-h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">
            Gerencie o cashback dos clientes da agencia
          </p>
        </div>
        <Link to="/import">
          <Button>
            <Upload className="h-4 w-4 mr-2" />
            Importar Dados
          </Button>
        </Link>
      </div>

      {stats && (
        <StatsCards
          totalPoints={stats.totalPoints}
          activeCustomers={stats.activeCustomers}
          completedTrips={stats.completedTrips}
        />
      )}

      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Clientes</h2>
        <CustomersTable initialCustomers={customers} onRefresh={fetchData} />
      </div>
    </div>
  );
}
