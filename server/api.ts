import { Router } from "express";
import multer from "multer";
import * as XLSX from "xlsx";
import { PrismaClient, Prisma } from "@prisma/client";
import { z } from "zod";

const router = Router();
const prisma = new PrismaClient();
const upload = multer({ storage: multer.memoryStorage() });

// Validation schemas
const CustomerSchema = z.object({
  name: z.string().min(1, "Nome obrigatório"),
  cpf: z.string().regex(/^\d{11}$/, "CPF deve ter 11 dígitos"),
  email: z.string().email("Email inválido").optional().or(z.literal("")),
  phone: z.string().optional(),
});

const TripSchema = z.object({
  reservationId: z.string().min(1, "ID da reserva obrigatório"),
  customerCpf: z.string().regex(/^\d{11}$/, "CPF deve ter 11 dígitos"),
  totalValue: z.number().positive("Valor deve ser positivo"),
  returnDate: z.string(),
  status: z.enum(["PENDING", "COMPLETED"]),
  cashbackPercent: z.number().min(0).max(100),
});

const ImportDataSchema = z.object({
  customers: z.array(CustomerSchema),
  trips: z.array(TripSchema),
});

const ManualTransactionSchema = z.object({
  customerId: z.string().min(1),
  type: z.enum(["CREDIT", "DEBIT"]),
  points: z.number().int().positive(),
  description: z.string().min(1, "Descrição obrigatória"),
});

// GET /api/stats - Dashboard stats
router.get("/stats", async (_req, res) => {
  try {
    const [totalPoints, activeCustomers, completedTrips] = await Promise.all([
      prisma.customer.aggregate({ _sum: { totalPoints: true } }),
      prisma.customer.count({ where: { totalPoints: { gt: 0 } } }),
      prisma.trip.count({ where: { status: "COMPLETED" } }),
    ]);

    res.json({
      totalPoints: totalPoints._sum.totalPoints ?? 0,
      activeCustomers,
      completedTrips,
    });
  } catch (error) {
    console.error("Stats error:", error);
    res.status(500).json({ error: "Erro ao buscar estatísticas" });
  }
});

// GET /api/customers - List customers
router.get("/customers", async (req, res) => {
  try {
    const search = req.query.search as string | undefined;
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
      orderBy: { totalPoints: "desc" },
      take: 50,
    });

    res.json(customers);
  } catch (error) {
    console.error("Customers error:", error);
    res.status(500).json({ error: "Erro ao buscar clientes" });
  }
});

// GET /api/customers/:id - Get single customer
router.get("/customers/:id", async (req, res) => {
  try {
    const customer = await prisma.customer.findUnique({
      where: { id: req.params.id },
    });
    if (!customer) {
      return res.status(404).json({ error: "Cliente não encontrado" });
    }
    res.json(customer);
  } catch (error) {
    console.error("Customer error:", error);
    res.status(500).json({ error: "Erro ao buscar cliente" });
  }
});

// GET /api/customers/:id/transactions - Get customer transactions
router.get("/customers/:id/transactions", async (req, res) => {
  try {
    const transactions = await prisma.transaction.findMany({
      where: { customerId: req.params.id },
      orderBy: { createdAt: "desc" },
      take: 10,
      include: { trip: { select: { reservationId: true } } },
    });
    res.json(transactions);
  } catch (error) {
    console.error("Transactions error:", error);
    res.status(500).json({ error: "Erro ao buscar transações" });
  }
});

// POST /api/transactions - Add manual transaction
router.post("/transactions", async (req, res) => {
  try {
    const validation = ManualTransactionSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: "Dados inválidos",
        errors: validation.error.issues.map((e) => `${e.path.join(".")}: ${e.message}`),
      });
    }

    const { customerId, type, points, description } = validation.data;

    const customer = await prisma.customer.findUnique({ where: { id: customerId } });
    if (!customer) {
      return res.status(404).json({ success: false, message: "Cliente não encontrado" });
    }

    if (type === "DEBIT" && customer.totalPoints < points) {
      return res.status(400).json({
        success: false,
        message: `Saldo insuficiente. Saldo atual: ${customer.totalPoints} pontos`,
      });
    }

    const pointsChange = type === "CREDIT" ? points : -points;

    const result = await prisma.$transaction(async (tx) => {
      await tx.transaction.create({
        data: { type, points, description, customerId, tripId: null },
      });

      return tx.customer.update({
        where: { id: customerId },
        data: { totalPoints: { increment: pointsChange } },
      });
    });

    res.json({
      success: true,
      message: type === "CREDIT" ? `${points} pontos adicionados` : `${points} pontos removidos`,
      newBalance: result.totalPoints,
    });
  } catch (error) {
    console.error("Transaction error:", error);
    res.status(500).json({ success: false, message: "Erro ao processar transação" });
  }
});

// POST /api/import - Import JSON data
router.post("/import", async (req, res) => {
  try {
    const validation = ImportDataSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: "Dados inválidos",
        errors: validation.error.issues.map((e) => `${e.path.join(".")}: ${e.message}`),
      });
    }

    const result = await importData(validation.data);
    res.json(result);
  } catch (error) {
    console.error("Import error:", error);
    res.status(500).json({ success: false, message: "Erro ao importar dados" });
  }
});

// POST /api/import/excel - Import Excel file
router.post("/import/excel", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "Nenhum arquivo enviado" });
    }

    const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    if (!sheet) {
      return res.status(400).json({ success: false, message: "Planilha vazia" });
    }

    const headers = (XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1 })[0] || []) as string[];
    const isMondeFormat = ["Venda Nº", "Pagante", "CPF", "Receitas", "Tipo Pessoa"].every((col) =>
      headers.some((h) => h === col)
    );

    let customers: Array<{ name: string; cpf: string; email?: string; phone?: string }>;
    let trips: Array<{
      reservationId: string;
      customerCpf: string;
      totalValue: number;
      returnDate: string;
      status: "PENDING" | "COMPLETED";
      cashbackPercent: number;
    }>;
    let extraMessage = "";

    if (isMondeFormat) {
      const rawData = XLSX.utils.sheet_to_json(sheet) as MondeRow[];
      const result = processMondeData(rawData);
      customers = result.customers;
      trips = result.trips;
      extraMessage = ` (Monde: ${result.stats.filtered} linhas filtradas, ${result.stats.noEmail} sem email)`;
    } else {
      const rawData = XLSX.utils.sheet_to_json(sheet) as StandardRow[];
      const result = processStandardData(rawData);
      customers = result.customers;
      trips = result.trips;
    }

    if (customers.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Nenhum cliente válido encontrado",
        errors: ["Verifique se o CPF está preenchido corretamente (11 dígitos)"],
      });
    }

    const importResult = await importData({ customers, trips });
    if (importResult.success && extraMessage) {
      importResult.message += extraMessage;
    }

    res.json(importResult);
  } catch (error) {
    console.error("Excel import error:", error);
    res.status(500).json({
      success: false,
      message: "Erro ao processar planilha",
      errors: [error instanceof Error ? error.message : "Erro desconhecido"],
    });
  }
});

// GET /api/template - Download Excel template
router.get("/template", (_req, res) => {
  const workbook = XLSX.utils.book_new();
  const data = [
    {
      nome: "Maria Silva",
      cpf: "12345678901",
      email: "maria@email.com",
      telefone: "11999999999",
      reservationId: "RES001",
      totalValue: 5000,
      returnDate: "2024-12-01",
      status: "COMPLETED",
      cashbackPercent: 5,
    },
    {
      nome: "Maria Silva",
      cpf: "12345678901",
      email: "maria@email.com",
      telefone: "11999999999",
      reservationId: "RES002",
      totalValue: 3000,
      returnDate: "2024-12-15",
      status: "PENDING",
      cashbackPercent: 3,
    },
  ];

  const sheet = XLSX.utils.json_to_sheet(data);
  XLSX.utils.book_append_sheet(workbook, sheet, "Dados");
  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", "attachment; filename=modelo-importacao.xlsx");
  res.send(buffer);
});

// Helper types
interface MondeRow {
  "Venda Nº": number;
  "Data Venda": number;
  "Data Início": number;
  "Data Fim": number;
  Pagante: string;
  Vendedor: string;
  Setor: string;
  "E-mail": string;
  CPF: string;
  "Tipo Pessoa": string;
  Produto: string;
  "Valor Total": number;
  Receitas: number;
  Telefone?: string;
}

interface StandardRow {
  nome: string;
  cpf: string;
  email?: string;
  telefone?: string;
  reservationId?: string;
  totalValue?: number;
  returnDate?: string | number;
  status?: string;
  cashbackPercent?: number;
}

const CASHBACK_PERCENT = 3.2;

function parseExcelDate(value: number | string | undefined): string {
  if (!value) return new Date().toISOString();
  if (typeof value === "number") {
    const date = XLSX.SSF.parse_date_code(value);
    return new Date(date.y, date.m - 1, date.d).toISOString();
  }
  return new Date(value).toISOString();
}

function processMondeData(rawData: MondeRow[]) {
  const customersMap = new Map<string, { name: string; cpf: string; email?: string; phone?: string }>();
  const tripsMap = new Map<string, {
    reservationId: string;
    customerCpf: string;
    totalValue: number;
    returnDate: string;
    status: "PENDING" | "COMPLETED";
    cashbackPercent: number;
  }>();

  let filtered = 0;
  let noEmail = 0;

  for (const row of rawData) {
    if (row["Tipo Pessoa"] === "J") { filtered++; continue; }
    if (row.Setor !== "Lazer") { filtered++; continue; }
    if (row.Produto === "Taxa de Serviço") { filtered++; continue; }
    if (!row.Receitas || row.Receitas <= 0) { filtered++; continue; }

    let email = String(row["E-mail"] || "").toLowerCase().trim();
    if (email.includes(";")) email = email.split(";")[0].trim();
    if (email.includes(",")) email = email.split(",")[0].trim();
    if (email.includes("@welcome")) { filtered++; continue; }

    const cpf = String(row.CPF || "").replace(/\D/g, "");
    if (!cpf || cpf.length !== 11) { filtered++; continue; }

    if (!customersMap.has(cpf)) {
      const phone = row.Telefone ? String(row.Telefone).replace(/\D/g, "") : undefined;
      customersMap.set(cpf, {
        name: String(row.Pagante || "").trim(),
        cpf,
        email: email || undefined,
        phone: phone || undefined,
      });
      if (!email) noEmail++;
    }

    const vendaId = String(row["Venda Nº"]);
    const existing = tripsMap.get(vendaId);
    if (existing) {
      existing.totalValue += row.Receitas;
    } else {
      tripsMap.set(vendaId, {
        reservationId: vendaId,
        customerCpf: cpf,
        totalValue: row.Receitas,
        returnDate: parseExcelDate(row["Data Fim"]),
        status: "COMPLETED",
        cashbackPercent: CASHBACK_PERCENT,
      });
    }
  }

  return {
    customers: Array.from(customersMap.values()),
    trips: Array.from(tripsMap.values()),
    stats: { filtered, noEmail },
  };
}

function processStandardData(rawData: StandardRow[]) {
  const customersMap = new Map<string, { name: string; cpf: string; email?: string; phone?: string }>();
  const trips: Array<{
    reservationId: string;
    customerCpf: string;
    totalValue: number;
    returnDate: string;
    status: "PENDING" | "COMPLETED";
    cashbackPercent: number;
  }> = [];

  for (const row of rawData) {
    const cpf = String(row.cpf || "").replace(/\D/g, "");
    if (!cpf || cpf.length !== 11) continue;

    if (!customersMap.has(cpf)) {
      customersMap.set(cpf, {
        name: String(row.nome || "").trim(),
        cpf,
        email: row.email ? String(row.email).trim() : undefined,
        phone: row.telefone ? String(row.telefone).trim() : undefined,
      });
    }

    if (row.reservationId && row.totalValue) {
      trips.push({
        reservationId: String(row.reservationId).trim(),
        customerCpf: cpf,
        totalValue: Number(row.totalValue) || 0,
        returnDate: parseExcelDate(row.returnDate),
        status: String(row.status || "").toUpperCase() === "COMPLETED" ? "COMPLETED" : "PENDING",
        cashbackPercent: Number(row.cashbackPercent) || 0,
      });
    }
  }

  return { customers: Array.from(customersMap.values()), trips };
}

async function importData(data: { customers: Array<{ name: string; cpf: string; email?: string; phone?: string }>; trips: Array<{ reservationId: string; customerCpf: string; totalValue: number; returnDate: string; status: "PENDING" | "COMPLETED"; cashbackPercent: number }> }) {
  const stats = { customersCreated: 0, customersUpdated: 0, tripsCreated: 0, transactionsCreated: 0, totalPointsAdded: 0 };

  for (const customer of data.customers) {
    const existing = await prisma.customer.findUnique({ where: { cpf: customer.cpf } });
    if (existing) {
      await prisma.customer.update({
        where: { cpf: customer.cpf },
        data: { name: customer.name, email: customer.email || null, phone: customer.phone || null },
      });
      stats.customersUpdated++;
    } else {
      await prisma.customer.create({
        data: { name: customer.name, email: customer.email || null, phone: customer.phone || null, cpf: customer.cpf },
      });
      stats.customersCreated++;
    }
  }

  for (const trip of data.trips) {
    const customer = await prisma.customer.findUnique({ where: { cpf: trip.customerCpf } });
    if (!customer) continue;

    const existingTrip = await prisma.trip.findUnique({ where: { reservationId: trip.reservationId } });
    if (existingTrip) continue;

    const points = Math.floor(trip.totalValue * (trip.cashbackPercent / 100));

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

      if (trip.status === "COMPLETED" && points > 0) {
        await tx.transaction.create({
          data: {
            type: "CREDIT",
            points,
            description: `Cashback da reserva ${trip.reservationId}`,
            customerId: customer.id,
            tripId: newTrip.id,
          },
        });

        await tx.customer.update({
          where: { id: customer.id },
          data: { totalPoints: { increment: points } },
        });

        stats.transactionsCreated++;
        stats.totalPointsAdded += points;
      }
    });
  }

  return { success: true, message: "Importação concluída com sucesso", stats };
}

export default router;
