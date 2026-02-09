import { z } from "zod";

export const CustomerImportSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  email: z.string().email("Email inválido").optional().or(z.literal("")),
  phone: z.string().optional().or(z.literal("")),
  cpf: z.string().regex(/^\d{11}$/, "CPF deve conter 11 dígitos"),
});

export const TripImportSchema = z.object({
  reservationId: z.string().min(1, "ID da reserva é obrigatório"),
  customerCpf: z.string().regex(/^\d{11}$/, "CPF deve conter 11 dígitos"),
  totalValue: z.number().positive("Valor deve ser positivo"),
  returnDate: z.string().datetime("Data de retorno inválida"),
  status: z.enum(["PENDING", "COMPLETED"]),
  cashbackPercent: z.number().min(0).max(100, "Percentual deve ser entre 0 e 100"),
});

export const ImportDataSchema = z.object({
  customers: z.array(CustomerImportSchema),
  trips: z.array(TripImportSchema),
});

export type CustomerImport = z.infer<typeof CustomerImportSchema>;
export type TripImport = z.infer<typeof TripImportSchema>;
export type ImportData = z.infer<typeof ImportDataSchema>;
