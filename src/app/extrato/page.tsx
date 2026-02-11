import { TransactionList } from "@/components/dashboard/transaction-list";
import {
  getTransactions,
  getCustomersForSelect,
} from "@/actions/transactions";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export const dynamic = "force-dynamic";

interface ExtratoPageProps {
  searchParams: Promise<{
    customerId?: string;
    startDate?: string;
    endDate?: string;
    type?: "CREDIT" | "DEBIT";
    page?: string;
  }>;
}

export default async function ExtratoPage({ searchParams }: ExtratoPageProps) {
  const params = await searchParams;

  const filters = {
    customerId: params.customerId,
    startDate: params.startDate,
    endDate: params.endDate,
    type: params.type,
    page: params.page ? parseInt(params.page, 10) : 1,
    limit: 20,
  };

  const [transactionsResult, customers] = await Promise.all([
    getTransactions(filters),
    getCustomersForSelect(),
  ]);

  return (
    <div className="container mx-auto py-8 px-4 space-y-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/dashboard">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Extrato</h1>
            <p className="text-muted-foreground">
              Historico de entradas e saidas de pontos
            </p>
          </div>
        </div>
      </div>

      <TransactionList
        initialData={transactionsResult}
        customers={customers}
        initialFilters={filters}
      />
    </div>
  );
}
