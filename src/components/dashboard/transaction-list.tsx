"use client";

import { useRouter } from "next/navigation";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCPF, formatPoints } from "@/lib/utils";
import type { GetTransactionsResult } from "@/lib/validations/extrato";
import { Filter, ChevronLeft, ChevronRight } from "lucide-react";

interface Customer {
  id: string;
  name: string;
  cpf: string;
}

interface TransactionListProps {
  initialData: GetTransactionsResult;
  customers: Customer[];
  initialFilters: {
    customerId?: string;
    startDate?: string;
    endDate?: string;
    type?: "CREDIT" | "DEBIT";
    page: number;
  };
}

export function TransactionList({
  initialData,
  customers,
  initialFilters,
}: TransactionListProps) {
  const router = useRouter();

  const applyFilters = (newFilters: typeof initialFilters) => {
    const params = new URLSearchParams();

    if (newFilters.customerId) params.set("customerId", newFilters.customerId);
    if (newFilters.startDate) params.set("startDate", newFilters.startDate);
    if (newFilters.endDate) params.set("endDate", newFilters.endDate);
    if (newFilters.type) params.set("type", newFilters.type);
    if (newFilters.page > 1) params.set("page", String(newFilters.page));

    router.push(`/extrato?${params.toString()}`);
  };

  const handleFilterChange = (key: string, value: string | undefined) => {
    const newFilters = { ...initialFilters, [key]: value, page: 1 };
    applyFilters(newFilters);
  };

  const handlePageChange = (newPage: number) => {
    const newFilters = { ...initialFilters, page: newPage };
    applyFilters(newFilters);
  };

  return (
    <div className="space-y-6">
      {/* Filtros */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Filter className="h-4 w-4" />
            Filtros
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            {/* Filtro por cliente */}
            <div>
              <label className="text-sm font-medium mb-2 block">Cliente</label>
              <select
                className="w-full p-2 border rounded-md bg-background"
                value={initialFilters.customerId || ""}
                onChange={(e) =>
                  handleFilterChange("customerId", e.target.value || undefined)
                }
              >
                <option value="">Todos os clientes</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} - {formatCPF(c.cpf)}
                  </option>
                ))}
              </select>
            </div>

            {/* Filtro por tipo */}
            <div>
              <label className="text-sm font-medium mb-2 block">Tipo</label>
              <select
                className="w-full p-2 border rounded-md bg-background"
                value={initialFilters.type || ""}
                onChange={(e) =>
                  handleFilterChange("type", e.target.value || undefined)
                }
              >
                <option value="">Todos</option>
                <option value="CREDIT">Credito</option>
                <option value="DEBIT">Debito</option>
              </select>
            </div>

            {/* Data inicio */}
            <div>
              <label className="text-sm font-medium mb-2 block">
                Data inicial
              </label>
              <Input
                type="date"
                value={initialFilters.startDate?.split("T")[0] || ""}
                onChange={(e) =>
                  handleFilterChange(
                    "startDate",
                    e.target.value
                      ? `${e.target.value}T00:00:00.000Z`
                      : undefined
                  )
                }
              />
            </div>

            {/* Data fim */}
            <div>
              <label className="text-sm font-medium mb-2 block">
                Data final
              </label>
              <Input
                type="date"
                value={initialFilters.endDate?.split("T")[0] || ""}
                onChange={(e) =>
                  handleFilterChange(
                    "endDate",
                    e.target.value
                      ? `${e.target.value}T23:59:59.999Z`
                      : undefined
                  )
                }
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabela de transacoes */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Descricao</TableHead>
              <TableHead className="text-right">Pontos</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {initialData.transactions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center">
                  Nenhuma transacao encontrada.
                </TableCell>
              </TableRow>
            ) : (
              initialData.transactions.map((tx) => (
                <TableRow key={tx.id}>
                  <TableCell className="text-muted-foreground">
                    {new Date(tx.createdAt).toLocaleDateString("pt-BR")}
                  </TableCell>
                  <TableCell>
                    <div>
                      <div className="font-medium">{tx.customer.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {formatCPF(tx.customer.cpf)}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={tx.type === "CREDIT" ? "default" : "secondary"}
                    >
                      {tx.type === "CREDIT" ? "Credito" : "Debito"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {tx.description || tx.trip?.reservationId || "-"}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    <span
                      className={
                        tx.type === "CREDIT" ? "text-green-600" : "text-red-600"
                      }
                    >
                      {tx.type === "CREDIT" ? "+" : "-"}
                      {formatPoints(tx.points)}
                    </span>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Paginacao */}
      {initialData.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Mostrando pagina {initialData.page} de {initialData.totalPages} (
            {initialData.total} transacoes)
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(initialData.page - 1)}
              disabled={initialData.page <= 1}
            >
              <ChevronLeft className="h-4 w-4" />
              Anterior
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(initialData.page + 1)}
              disabled={initialData.page >= initialData.totalPages}
            >
              Proxima
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
