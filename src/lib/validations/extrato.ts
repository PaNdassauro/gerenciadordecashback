import { z } from "zod";

// Schema de validacao para filtros do extrato
export const GetTransactionsFilterSchema = z.object({
  customerId: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  type: z.enum(["CREDIT", "DEBIT"]).optional(),
  page: z.number().int().positive().default(1),
  limit: z.number().int().positive().max(100).default(20),
});

export type GetTransactionsFilter = z.infer<typeof GetTransactionsFilterSchema>;

export interface TransactionWithCustomer {
  id: string;
  type: "CREDIT" | "DEBIT";
  points: number;
  description: string | null;
  createdAt: Date;
  customer: {
    id: string;
    name: string;
    cpf: string;
  };
  trip: {
    reservationId: string;
  } | null;
}

export interface GetTransactionsResult {
  transactions: TransactionWithCustomer[];
  total: number;
  page: number;
  totalPages: number;
}
