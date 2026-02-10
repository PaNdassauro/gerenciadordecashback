import { type ImportData } from "./validations/import";

export const CASHBACK_PERCENT = 3.2;

export interface StandardRow {
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

export interface MondeRow {
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

export function isMondeFormat(headers: string[]): boolean {
    const mondeColumns = ["Venda Nº", "Pagante", "CPF", "Receitas", "Tipo Pessoa"];
    return mondeColumns.every((col) =>
        headers.some((h) => h === col)
    );
}

export function parseExcelDate(value: number | string | undefined, SSF: any): string {
    if (!value) return new Date().toISOString();

    if (typeof value === "number" && SSF) {
        const date = SSF.parse_date_code(value);
        return new Date(date.y, date.m - 1, date.d).toISOString();
    }
    return new Date(value).toISOString();
}

export function processMondeData(rawData: MondeRow[], SSF: any): ImportData {
    const customersMap = new Map<string, {
        name: string;
        cpf: string;
        email?: string;
        phone?: string;
    }>();

    const tripsMap = new Map<string, {
        reservationId: string;
        customerCpf: string;
        totalValue: number;
        returnDate: string;
        status: "PENDING" | "COMPLETED";
        cashbackPercent: number;
    }>();

    for (const row of rawData) {
        if (row["Tipo Pessoa"] === "J") continue;
        if (row.Setor !== "Lazer") continue;
        if (row.Produto === "Taxa de Serviço") continue;
        if (!row.Receitas || row.Receitas <= 0) continue;

        let email = String(row["E-mail"] || "").toLowerCase().trim();
        if (email.includes(";")) email = email.split(";")[0].trim();
        if (email.includes(",")) email = email.split(",")[0].trim();
        if (email.includes("@welcome")) continue;

        const cpf = String(row.CPF || "").replace(/\D/g, "");
        if (!cpf || cpf.length !== 11) continue;

        if (!customersMap.has(cpf)) {
            const phone = row.Telefone ? String(row.Telefone).replace(/\D/g, "") : undefined;
            customersMap.set(cpf, {
                name: String(row.Pagante || "").trim(),
                cpf,
                email: email || undefined,
                phone: phone || undefined,
            });
        }

        const vendaId = String(row["Venda Nº"]);
        const existingTrip = tripsMap.get(vendaId);

        if (existingTrip) {
            existingTrip.totalValue += row.Receitas;
        } else {
            tripsMap.set(vendaId, {
                reservationId: vendaId,
                customerCpf: cpf,
                totalValue: row.Receitas,
                returnDate: parseExcelDate(row["Data Fim"], SSF),
                status: "COMPLETED",
                cashbackPercent: CASHBACK_PERCENT,
            });
        }
    }

    return {
        customers: Array.from(customersMap.values()),
        trips: Array.from(tripsMap.values()),
    };
}

export function processStandardData(rawData: StandardRow[], SSF: any): ImportData {
    const customersMap = new Map<string, {
        name: string;
        cpf: string;
        email?: string;
        phone?: string;
    }>();

    const trips: any[] = [];

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
                returnDate: parseExcelDate(row.returnDate, SSF),
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
