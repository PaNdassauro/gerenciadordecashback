"use server";

import { prisma } from "@/lib/prisma";
import { ManualTransactionSchema } from "@/lib/validations/transaction";
import {
  GetTransactionsFilterSchema,
  type GetTransactionsResult,
  type TransactionWithCustomer,
} from "@/lib/validations/extrato";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";

interface TransactionResult {
  success: boolean;
  message: string;
  newBalance?: number;
  errors?: string[];
}

export async function addManualTransaction(
  data: unknown
): Promise<TransactionResult> {
  const validation = ManualTransactionSchema.safeParse(data);

  if (!validation.success) {
    return {
      success: false,
      message: "Dados invalidos",
      errors: validation.error.issues.map(
        (e) => `${e.path.join(".")}: ${e.message}`
      ),
    };
  }

  const { customerId, type, points, description } = validation.data;

  try {
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
    });

    if (!customer) {
      return {
        success: false,
        message: "Cliente nao encontrado",
      };
    }

    // Validate sufficient balance for debit
    if (type === "DEBIT" && customer.totalPoints < points) {
      return {
        success: false,
        message: `Saldo insuficiente. Saldo atual: ${customer.totalPoints} pontos`,
      };
    }

    const pointsChange = type === "CREDIT" ? points : -points;

    const result = await prisma.$transaction(async (tx) => {
      await tx.transaction.create({
        data: {
          type,
          points,
          description,
          customerId,
          tripId: null,
        },
      });

      const updatedCustomer = await tx.customer.update({
        where: { id: customerId },
        data: {
          totalPoints: {
            increment: pointsChange,
          },
        },
      });

      return updatedCustomer;
    });

    revalidatePath("/dashboard");

    return {
      success: true,
      message:
        type === "CREDIT"
          ? `${points} pontos adicionados com sucesso`
          : `${points} pontos removidos com sucesso`,
      newBalance: result.totalPoints,
    };
  } catch (error) {
    console.error("Transaction error:", error);
    return {
      success: false,
      message: "Erro ao processar transacao",
      errors: [error instanceof Error ? error.message : "Erro desconhecido"],
    };
  }
}

export async function getCustomerById(customerId: string) {
  return prisma.customer.findUnique({
    where: { id: customerId },
  });
}

export async function getCustomerTransactions(customerId: string, limit = 10) {
  return prisma.transaction.findMany({
    where: { customerId },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      trip: {
        select: {
          reservationId: true,
        },
      },
    },
  });
}

export async function getTransactions(
  filters: unknown
): Promise<GetTransactionsResult> {
  const validation = GetTransactionsFilterSchema.safeParse(filters);

  if (!validation.success) {
    return { transactions: [], total: 0, page: 1, totalPages: 0 };
  }

  const { customerId, startDate, endDate, type, page, limit } = validation.data;

  const where: Prisma.TransactionWhereInput = {};

  if (customerId) {
    where.customerId = customerId;
  }

  if (type) {
    where.type = type;
  }

  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) {
      where.createdAt.gte = new Date(startDate);
    }
    if (endDate) {
      where.createdAt.lte = new Date(endDate);
    }
  }

  const [transactions, total] = await Promise.all([
    prisma.transaction.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            cpf: true,
          },
        },
        trip: {
          select: {
            reservationId: true,
          },
        },
      },
    }),
    prisma.transaction.count({ where }),
  ]);

  return {
    transactions: transactions as TransactionWithCustomer[],
    total,
    page,
    totalPages: Math.ceil(total / limit),
  };
}

export async function getCustomersForSelect() {
  return prisma.customer.findMany({
    select: {
      id: true,
      name: true,
      cpf: true,
    },
    orderBy: { name: "asc" },
  });
}
