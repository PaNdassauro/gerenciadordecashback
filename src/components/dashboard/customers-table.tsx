"use client";

import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { formatCPF, formatPoints } from "@/lib/utils";
import { PointsModal } from "./points-modal";
import { Search } from "lucide-react";

interface Customer {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  cpf: string;
  totalPoints: number;
}

interface CustomersTableProps {
  initialCustomers: Customer[];
  onRefresh?: () => void;
}

export function CustomersTable({ initialCustomers, onRefresh }: CustomersTableProps) {
  const [customers, setCustomers] = useState(initialCustomers);
  const [search, setSearch] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const handleSearch = async (value: string) => {
    setSearch(value);
    setIsSearching(true);
    try {
      const params = value ? `?search=${encodeURIComponent(value)}` : "";
      const response = await fetch(`/api/customers${params}`);
      const results = await response.json();
      setCustomers(results);
    } catch (error) {
      console.error("Search error:", error);
    } finally {
      setIsSearching(false);
    }
  };

  const handleRowClick = (customer: Customer) => {
    setSelectedCustomer(customer);
    setModalOpen(true);
  };

  const handleSuccess = async () => {
    try {
      const params = search ? `?search=${encodeURIComponent(search)}` : "";
      const response = await fetch(`/api/customers${params}`);
      const results = await response.json();
      setCustomers(results);
      if (selectedCustomer) {
        const updated = results.find((c: Customer) => c.id === selectedCustomer.id);
        if (updated) setSelectedCustomer(updated);
      }
      onRefresh?.();
    } catch (error) {
      console.error("Refresh error:", error);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, CPF ou email..."
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        {isSearching && (
          <span className="text-sm text-muted-foreground">Buscando...</span>
        )}
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>CPF</TableHead>
              <TableHead>Telefone</TableHead>
              <TableHead>Email</TableHead>
              <TableHead className="text-right">Saldo de Pontos</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {customers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center">
                  Nenhum cliente encontrado.
                </TableCell>
              </TableRow>
            ) : (
              customers.map((customer) => (
                <TableRow
                  key={customer.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => handleRowClick(customer)}
                >
                  <TableCell className="font-medium">{customer.name}</TableCell>
                  <TableCell className="font-mono text-sm">
                    {formatCPF(customer.cpf)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {customer.phone || "-"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {customer.email || "-"}
                  </TableCell>
                  <TableCell className="text-right">
                    <Badge variant={customer.totalPoints > 0 ? "default" : "secondary"}>
                      {formatPoints(customer.totalPoints)} pts
                    </Badge>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <PointsModal
        customer={selectedCustomer}
        open={modalOpen}
        onOpenChange={setModalOpen}
        onSuccess={handleSuccess}
      />
    </div>
  );
}
