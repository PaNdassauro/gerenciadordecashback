import { NextResponse } from "next/server";
export async function GET() {
  const XLSX = await import("xlsx");
  const workbook = XLSX.utils.book_new();

  // Single sheet with all data
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
    {
      nome: "Joao Santos",
      cpf: "98765432100",
      email: "",
      telefone: "",
      reservationId: "RES003",
      totalValue: 8000,
      returnDate: "2024-11-20",
      status: "COMPLETED",
      cashbackPercent: 4,
    },
  ];

  const sheet = XLSX.utils.json_to_sheet(data);

  // Set column widths
  sheet["!cols"] = [
    { wch: 20 }, // nome
    { wch: 14 }, // cpf
    { wch: 25 }, // email
    { wch: 15 }, // telefone
    { wch: 15 }, // reservationId
    { wch: 12 }, // totalValue
    { wch: 12 }, // returnDate
    { wch: 12 }, // status
    { wch: 15 }, // cashbackPercent
  ];

  XLSX.utils.book_append_sheet(workbook, sheet, "Dados");

  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

  return new NextResponse(buffer, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": "attachment; filename=modelo-importacao.xlsx",
    },
  });
}
