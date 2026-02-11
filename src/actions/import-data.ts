"use server";

import { prisma } from "@/lib/prisma";
import { ImportDataSchema, type ImportData } from "@/lib/validations/import";
import { Prisma } from "@prisma/client";

export interface ImportResult {
  success: boolean;
  message: string;
  stats?: {
    customersCreated: number;
    customersUpdated: number;
    tripsCreated: number;
    transactionsCreated: number;
    totalPointsAdded: number;
  };
  errors?: string[];
}

export async function importData(data: unknown): Promise<ImportResult> {
  const validation = ImportDataSchema.safeParse(data);

  if (!validation.success) {
    return {
      success: false,
      message: "Dados inválidos",
      errors: validation.error.issues.map(
        (e) => `${e.path.join(".")}: ${e.message}`
      ),
    };
  }

  const { customers, trips } = validation.data;

  try {
    const stats = {
      customersCreated: 0,
      customersUpdated: 0,
      tripsCreated: 0,
      transactionsCreated: 0,
      totalPointsAdded: 0,
    };

    // Upsert customers
    for (const customer of customers) {
      const existing = await prisma.customer.findUnique({
        where: { cpf: customer.cpf },
      });

      if (existing) {
        await prisma.customer.update({
          where: { cpf: customer.cpf },
          data: {
            name: customer.name,
            email: customer.email || null,
            phone: customer.phone || null,
          },
        });
        stats.customersUpdated++;
      } else {
        await prisma.customer.create({
          data: {
            name: customer.name,
            email: customer.email || null,
            phone: customer.phone || null,
            cpf: customer.cpf,
          },
        });
        stats.customersCreated++;
      }
    }

    // Create trips and transactions
    for (const trip of trips) {
      const customer = await prisma.customer.findUnique({
        where: { cpf: trip.customerCpf },
      });

      if (!customer) {
        continue;
      }

      // Check if trip already exists
      const existingTrip = await prisma.trip.findUnique({
        where: { reservationId: trip.reservationId },
      });

      if (existingTrip) {
        continue;
      }

      // Calculate points: totalValue * cashbackPercent / 100
      const points = Math.floor(
        trip.totalValue * (trip.cashbackPercent / 100)
      );

      // Create trip with transaction in a single transaction
      await prisma.$transaction(async (tx) => {
        const newTrip = await tx.trip.create({
          data: {
            reservationId: trip.reservationId,
            totalValue: new Prisma.Decimal(trip.totalValue),
            returnDate: new Date(trip.returnDate),
            status: trip.status,
            cashbackPercent: new Prisma.Decimal(trip.cashbackPercent),
            customerId: customer.id,
          },
        });

        stats.tripsCreated++;

        // Only create transaction if trip is completed
        if (trip.status === "COMPLETED" && points > 0) {
          await tx.transaction.create({
            data: {
              type: "CREDIT",
              points: points,
              description: `Cashback da reserva ${trip.reservationId}`,
              customerId: customer.id,
              tripId: newTrip.id,
            },
          });

          // Update customer total points
          await tx.customer.update({
            where: { id: customer.id },
            data: {
              totalPoints: {
                increment: points,
              },
            },
          });

          stats.transactionsCreated++;
          stats.totalPointsAdded += points;
        }
      });
    }

    return {
      success: true,
      message: "Importação concluída com sucesso",
      stats,
    };
  } catch (error) {
    console.error("Import error:", error);
    return {
      success: false,
      message: "Erro ao importar dados",
      errors: [error instanceof Error ? error.message : "Erro desconhecido"],
    };
  }
}

export async function getDashboardStats() {
  const [totalPoints, activeCustomers, completedTrips, totalRevenueResult] =
    await Promise.all([
      prisma.customer.aggregate({
        _sum: {
          totalPoints: true,
        },
      }),
      prisma.customer.count({
        where: {
          totalPoints: {
            gt: 0,
          },
        },
      }),
      prisma.trip.count({
        where: {
          status: "COMPLETED",
        },
      }),
      prisma.trip.aggregate({
        _sum: {
          totalValue: true,
        },
      }),
    ]);

  const totalRevenue = Number(totalRevenueResult._sum.totalValue ?? 0);

  return {
    totalPoints: totalPoints._sum.totalPoints ?? 0,
    activeCustomers,
    completedTrips,
    totalRevenue1Percent: totalRevenue * 0.01,
  };
}

export async function getCustomers(search?: string) {
  const where = search
    ? {
        OR: [
          { name: { contains: search, mode: Prisma.QueryMode.insensitive } },
          { cpf: { contains: search } },
          { email: { contains: search, mode: Prisma.QueryMode.insensitive } },
        ],
      }
    : {};

  const customers = await prisma.customer.findMany({
    where,
    orderBy: {
      totalPoints: "desc",
    },
    take: 50,
    include: {
      trips: {
        select: {
          totalValue: true,
        },
      },
    },
  });

  return customers.map((customer) => {
    const totalRevenue = customer.trips.reduce(
      (sum, trip) => sum + Number(trip.totalValue),
      0
    );
    const { trips, ...customerData } = customer;
    return {
      ...customerData,
      totalRevenue,
    };
  });
}
