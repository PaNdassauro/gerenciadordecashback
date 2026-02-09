"use server";

import { importData, type ImportResult } from "./import-data";
import * as XLSX from "xlsx";

// Formato padrao (modelo)
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

// Formato Monde (relatorio bruto)
interface MondeRow {
  "Venda Nº": number;
  "Data Venda": number;
  "Data Início": number;
  "Data Fim": number;
  Pagante: string;
  Vendedor: string;
  Setor: string;
  Passageiros?: string;
  "E-mail": string;
  CPF: string;
  "Tipo Pessoa": string;
  Produto: string;
  "Valor Total": number;
  Receitas: number;
  Telefone?: string;
}

const CASHBACK_PERCENT = 3.2; // Percentual fixo de cashback

function isMondeFormat(headers: string[]): boolean {
  const mondeColumns = ["Venda Nº", "Pagante", "CPF", "Receitas", "Tipo Pessoa"];
  return mondeColumns.every((col) =>
    headers.some((h) => h === col)
  );
}

function parseExcelDate(value: number | string | undefined): string {
  if (!value) return new Date().toISOString();

  if (typeof value === "number") {
    const date = XLSX.SSF.parse_date_code(value);
    return new Date(date.y, date.m - 1, date.d).toISOString();
  }
  return new Date(value).toISOString();
}

function processMondeData(rawData: MondeRow[]): {
  customers: Array<{ name: string; cpf: string; email?: string; phone?: string }>;
  trips: Array<{
    reservationId: string;
    customerCpf: string;
    totalValue: number;
    returnDate: string;
    status: "PENDING" | "COMPLETED";
    cashbackPercent: number;
  }>;
  stats: { filtered: number; noEmail: number };
} {
  const customersMap = new Map<string, {
    name: string;
    cpf: string;
    email?: string;
    phone?: string;
  }>();

  // Agrupar receitas por Venda Nº
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
    // Aplicar filtros do script R
    // 1. Tipo Pessoa != "J" (só pessoa física)
    if (row["Tipo Pessoa"] === "J") {
      filtered++;
      continue;
    }

    // 2. Setor == "Lazer"
    if (row.Setor !== "Lazer") {
      filtered++;
      continue;
    }

    // 3. Produto != "Taxa de Serviço"
    if (row.Produto === "Taxa de Serviço") {
      filtered++;
      continue;
    }

    // 4. Receitas > 0
    if (!row.Receitas || row.Receitas <= 0) {
      filtered++;
      continue;
    }

    // 5. Email sem "@welcome"
    // Handle multiple emails separated by ; or , - take the first one
    let email = String(row["E-mail"] || "").toLowerCase().trim();
    if (email.includes(";")) email = email.split(";")[0].trim();
    if (email.includes(",")) email = email.split(",")[0].trim();
    if (email.includes("@welcome")) {
      filtered++;
      continue;
    }

    // Validar CPF
    const cpf = String(row.CPF || "").replace(/\D/g, "");
    if (!cpf || cpf.length !== 11) {
      filtered++;
      continue;
    }

    // Adicionar cliente (CPF único)
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

    // Agrupar viagens pelo Venda Nº (somar receitas)
    const vendaId = String(row["Venda Nº"]);
    const existingTrip = tripsMap.get(vendaId);

    if (existingTrip) {
      // Somar receitas da mesma venda
      existingTrip.totalValue += row.Receitas;
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

function processStandardData(rawData: StandardRow[]): {
  customers: Array<{ name: string; cpf: string; email?: string; phone?: string }>;
  trips: Array<{
    reservationId: string;
    customerCpf: string;
    totalValue: number;
    returnDate: string;
    status: "PENDING" | "COMPLETED";
    cashbackPercent: number;
  }>;
} {
  const customersMap = new Map<string, {
    name: string;
    cpf: string;
    email?: string;
    phone?: string;
  }>();

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
        status: String(row.status || "").toUpperCase() === "COMPLETED"
          ? "COMPLETED"
          : "PENDING",
        cashbackPercent: Number(row.cashbackPercent) || 0,
      });
    }
  }

  return {
    customers: Array.from(customersMap.values()),
    trips,
  };
}

export async function importExcelFile(formData: FormData): Promise<ImportResult> {
  try {
    const file = formData.get("file") as File;

    if (!file) {
      return {
        success: false,
        message: "Nenhum arquivo enviado",
      };
    }

    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: "array" });

    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];

    if (!sheet) {
      return {
        success: false,
        message: "Planilha vazia",
      };
    }

    // Get headers to detect format
    const headers = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1 })[0] || [];

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

    if (isMondeFormat(headers)) {
      // Formato Monde detectado
      const rawData = XLSX.utils.sheet_to_json<MondeRow>(sheet);
      const result = processMondeData(rawData);
      customers = result.customers;
      trips = result.trips;
      extraMessage = ` (Monde: ${result.stats.filtered} linhas filtradas, ${result.stats.noEmail} sem email)`;
    } else {
      // Formato padrão
      const rawData = XLSX.utils.sheet_to_json<StandardRow>(sheet);
      const result = processStandardData(rawData);
      customers = result.customers;
      trips = result.trips;
    }

    if (customers.length === 0) {
      return {
        success: false,
        message: "Nenhum cliente valido encontrado",
        errors: ["Verifique se o CPF esta preenchido corretamente (11 digitos)"],
      };
    }

    const importResult = await importData({ customers, trips });

    if (importResult.success && extraMessage) {
      importResult.message += extraMessage;
    }

    return importResult;
  } catch (error) {
    console.error("Excel import error:", error);
    return {
      success: false,
      message: "Erro ao processar planilha",
      errors: [error instanceof Error ? error.message : "Erro desconhecido"],
    };
  }
}
