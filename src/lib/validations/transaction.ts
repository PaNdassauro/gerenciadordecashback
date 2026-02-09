import { z } from "zod";

export const ManualTransactionSchema = z.object({
  customerId: z.string().min(1, "Cliente obrigatorio"),
  type: z.enum(["CREDIT", "DEBIT"]),
  points: z.number().int().positive("Quantidade de pontos deve ser positiva"),
  description: z.string().min(1, "Descricao obrigatoria"),
});

export type ManualTransaction = z.infer<typeof ManualTransactionSchema>;
