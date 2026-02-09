"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { formatPoints, formatCPF } from "@/lib/utils";
import { Plus, Minus, Loader2, CheckCircle, XCircle } from "lucide-react";

interface Customer {
  id: string;
  name: string;
  cpf: string;
  email: string | null;
  phone: string | null;
  totalPoints: number;
}

interface Transaction {
  id: string;
  type: "CREDIT" | "DEBIT";
  points: number;
  description: string | null;
  createdAt: string;
  trip: { reservationId: string } | null;
}

interface PointsModalProps {
  customer: Customer | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function PointsModal({
  customer,
  open,
  onOpenChange,
  onSuccess,
}: PointsModalProps) {
  const [type, setType] = useState<"CREDIT" | "DEBIT">("CREDIT");
  const [points, setPoints] = useState("");
  const [description, setDescription] = useState("");
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [result, setResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  useEffect(() => {
    if (customer && open) {
      setIsLoadingHistory(true);
      fetch(`/api/customers/${customer.id}/transactions`)
        .then((res) => res.json())
        .then((data) => {
          setTransactions(data);
          setIsLoadingHistory(false);
        })
        .catch(() => setIsLoadingHistory(false));
      // Reset form
      setType("CREDIT");
      setPoints("");
      setDescription("");
      setResult(null);
    }
  }, [customer, open]);

  const handleSubmit = async () => {
    if (!customer || !points || !description) return;

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: customer.id,
          type,
          points: parseInt(points, 10),
          description,
        }),
      });

      const res = await response.json();
      setResult(res);

      if (res.success) {
        setPoints("");
        setDescription("");
        // Refresh transactions
        const txResponse = await fetch(`/api/customers/${customer.id}/transactions`);
        const updated = await txResponse.json();
        setTransactions(updated);
        onSuccess();
      }
    } catch {
      setResult({ success: false, message: "Erro ao processar transacao" });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!customer) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Gerenciar Pontos</DialogTitle>
          <DialogDescription>
            {customer.name} - {formatCPF(customer.cpf)}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Current Balance */}
          <div className="text-center p-4 bg-muted rounded-lg">
            <p className="text-sm text-muted-foreground">Saldo Atual</p>
            <p className="text-3xl font-bold">
              {formatPoints(customer.totalPoints)} pts
            </p>
          </div>

          {/* Transaction Type */}
          <div className="flex gap-2">
            <Button
              variant={type === "CREDIT" ? "default" : "outline"}
              className="flex-1"
              onClick={() => setType("CREDIT")}
            >
              <Plus className="h-4 w-4 mr-2" />
              Creditar
            </Button>
            <Button
              variant={type === "DEBIT" ? "default" : "outline"}
              className="flex-1"
              onClick={() => setType("DEBIT")}
            >
              <Minus className="h-4 w-4 mr-2" />
              Debitar
            </Button>
          </div>

          {/* Form */}
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">Quantidade de Pontos</label>
              <Input
                type="number"
                min="1"
                placeholder="Ex: 500"
                value={points}
                onChange={(e) => setPoints(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium">Motivo/Descricao</label>
              <Input
                placeholder="Ex: Bonus de indicacao"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
          </div>

          {/* Submit Button */}
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || !points || !description}
            className="w-full"
          >
            {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {type === "CREDIT" ? "Adicionar Pontos" : "Remover Pontos"}
          </Button>

          {/* Result Message */}
          {result && (
            <div
              className={`flex items-center gap-2 p-3 rounded-lg ${
                result.success
                  ? "bg-green-50 text-green-700"
                  : "bg-red-50 text-red-700"
              }`}
            >
              {result.success ? (
                <CheckCircle className="h-4 w-4" />
              ) : (
                <XCircle className="h-4 w-4" />
              )}
              <span className="text-sm">{result.message}</span>
            </div>
          )}

          {/* Transaction History */}
          <div>
            <h4 className="text-sm font-medium mb-2">Historico Recente</h4>
            {isLoadingHistory ? (
              <p className="text-sm text-muted-foreground">Carregando...</p>
            ) : transactions.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nenhuma transacao encontrada
              </p>
            ) : (
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {transactions.map((tx) => (
                  <div
                    key={tx.id}
                    className="flex items-center justify-between text-sm p-2 bg-muted rounded"
                  >
                    <div>
                      <Badge
                        variant={tx.type === "CREDIT" ? "default" : "secondary"}
                        className="mr-2"
                      >
                        {tx.type === "CREDIT" ? "+" : "-"}
                        {tx.points}
                      </Badge>
                      <span className="text-muted-foreground">
                        {tx.description || tx.trip?.reservationId || "Manual"}
                      </span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {new Date(tx.createdAt).toLocaleDateString("pt-BR")}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
