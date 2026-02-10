"use client";

export const dynamic = "force-static";
export const maxDuration = 300;

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { importData, type ImportResult } from "@/actions/import-data";
import {
  Upload,
  CheckCircle,
  XCircle,
  ArrowLeft,
  FileSpreadsheet,
  FileJson,
  Download,
  Loader2,
} from "lucide-react";
import Link from "next/link";
import {
  isMondeFormat,
  processMondeData,
  processStandardData,
} from "@/lib/import-utils";

const exampleJson = `{
  "customers": [
    {
      "name": "Maria Silva",
      "cpf": "12345678901",
      "email": "maria@email.com",
      "phone": "11999999999"
    }
  ],
  "trips": [
    {
      "reservationId": "RES001",
      "customerCpf": "12345678901",
      "totalValue": 5000,
      "returnDate": "2024-12-01T00:00:00Z",
      "status": "COMPLETED",
      "cashbackPercent": 5
    }
  ]
}`;

type ImportMode = "json" | "excel";

const CHUNK_SIZE = 100;

export default function ImportPage() {
  const [mode, setMode] = useState<ImportMode>("excel");
  const [jsonInput, setJsonInput] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImportChunks = async (customers: any[], trips: any[]) => {
    const totalChunks = Math.ceil(trips.length / CHUNK_SIZE);
    let stats = {
      customersCreated: 0,
      customersUpdated: 0,
      tripsCreated: 0,
      transactionsCreated: 0,
      totalPointsAdded: 0,
    };

    // First, import all customers in one or more batches
    // (Customers are usually fewer than trips, but let's chunk them too)
    const customerChunks = Math.ceil(customers.length / CHUNK_SIZE);
    setStatusText("Importando clientes...");
    for (let i = 0; i < customerChunks; i++) {
      const chunk = customers.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
      const res = await importData({ customers: chunk, trips: [] });
      if (!res.success) throw new Error(res.message);
      if (res.stats) {
        stats.customersCreated += res.stats.customersCreated;
        stats.customersUpdated += res.stats.customersUpdated;
      }
      setProgress(Math.round(((i + 1) / (customerChunks + totalChunks)) * 100));
    }

    // Then, import trips in chunks
    for (let i = 0; i < totalChunks; i++) {
      setStatusText(`Importando viagens: lote ${i + 1} de ${totalChunks}...`);
      const chunk = trips.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
      const res = await importData({ customers: [], trips: chunk });
      if (!res.success) throw new Error(res.message);
      if (res.stats) {
        stats.tripsCreated += res.stats.tripsCreated;
        stats.transactionsCreated += res.stats.transactionsCreated;
        stats.totalPointsAdded += res.stats.totalPointsAdded;
      }
      setProgress(
        Math.round(((customerChunks + i + 1) / (customerChunks + totalChunks)) * 100)
      );
    }

    return stats;
  };

  const handleJsonImport = async () => {
    setLoading(true);
    setResult(null);
    setProgress(0);

    try {
      const data = JSON.parse(jsonInput);
      const stats = await handleImportChunks(data.customers || [], data.trips || []);
      setResult({
        success: true,
        message: "Importação concluída com sucesso",
        stats,
      });
    } catch (err: any) {
      setResult({
        success: false,
        message: "Erro na importação",
        errors: [err.message || "Verifique a formatacao do JSON"],
      });
    } finally {
      setLoading(false);
      setStatusText("");
    }
  };

  const handleExcelImport = async () => {
    if (!selectedFile) return;

    setLoading(true);
    setResult(null);
    setProgress(0);
    setStatusText("Lendo arquivo...");

    try {
      const XLSX = await import("xlsx");
      const buffer = await selectedFile.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];

      if (!sheet) throw new Error("Planilha vazia");

      const headers = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1 })[0] || [];
      let parsedData;

      if (isMondeFormat(headers)) {
        setStatusText("Processando formato Monde...");
        const rawData = XLSX.utils.sheet_to_json<any>(sheet);
        parsedData = processMondeData(rawData, XLSX.SSF);
      } else {
        setStatusText("Processando formato padrão...");
        const rawData = XLSX.utils.sheet_to_json<any>(sheet);
        parsedData = processStandardData(rawData, XLSX.SSF);
      }

      if (parsedData.customers.length === 0 && parsedData.trips.length === 0) {
        throw new Error("Nenhum dado válido encontrado");
      }

      const stats = await handleImportChunks(parsedData.customers, parsedData.trips);
      setResult({
        success: true,
        message: "Importação concluída com sucesso",
        stats,
      });
    } catch (err: any) {
      console.error(err);
      setResult({
        success: false,
        message: "Erro ao processar arquivo",
        errors: [err.message || "Verifique se o arquivo esta no formato correto"],
      });
    } finally {
      setLoading(false);
      setStatusText("");
    }
  };

  const loadExample = () => {
    setJsonInput(exampleJson);
    setResult(null);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setResult(null);
    }
  };

  return (
    <div className="container mx-auto py-8 px-4 space-y-6 max-w-4xl">
      <div className="flex items-center gap-4">
        <Link href="/dashboard">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Importar Dados</h1>
          <p className="text-muted-foreground">
            Importe clientes e viagens a partir de planilha ou JSON
          </p>
        </div>
      </div>

      {/* Mode Toggle */}
      <div className="flex gap-2">
        <Button
          variant={mode === "excel" ? "default" : "outline"}
          onClick={() => {
            setMode("excel");
            setResult(null);
          }}
        >
          <FileSpreadsheet className="h-4 w-4 mr-2" />
          Planilha Excel
        </Button>
        <Button
          variant={mode === "json" ? "default" : "outline"}
          onClick={() => {
            setMode("json");
            setResult(null);
          }}
        >
          <FileJson className="h-4 w-4 mr-2" />
          JSON
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Input Card */}
        <Card>
          <CardHeader>
            <CardTitle>
              {mode === "excel" ? "Upload de Planilha" : "Dados JSON"}
            </CardTitle>
            <CardDescription>
              {mode === "excel"
                ? "Selecione um arquivo .xlsx com os dados"
                : "Cole o JSON com os dados de clientes e viagens"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {mode === "excel" ? (
              <>
                <div
                  className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary transition-colors"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx,.xls"
                    className="hidden"
                    onChange={handleFileSelect}
                  />
                  <FileSpreadsheet className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  {selectedFile ? (
                    <p className="font-medium">{selectedFile.name}</p>
                  ) : (
                    <p className="text-muted-foreground">
                      Clique para selecionar ou arraste o arquivo
                    </p>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={handleExcelImport}
                    disabled={loading || !selectedFile}
                    className="flex-1"
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    {loading ? "Importando..." : "Importar"}
                  </Button>
                  <Button variant="outline" asChild>
                    <a href="/api/template" download="modelo-importacao.xlsx">
                      <Download className="h-4 w-4 mr-2" />
                      Baixar Modelo
                    </a>
                  </Button>
                </div>
              </>
            ) : (
              <>
                <textarea
                  className="w-full h-80 p-3 text-sm font-mono border rounded-md bg-background resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder="Cole o JSON aqui..."
                  value={jsonInput}
                  onChange={(e) => setJsonInput(e.target.value)}
                />
                <div className="flex gap-2">
                  <Button
                    onClick={handleJsonImport}
                    disabled={loading || !jsonInput}
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    {loading ? "Importando..." : "Importar"}
                  </Button>
                  <Button variant="outline" onClick={loadExample}>
                    Carregar Exemplo
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Info Card */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Formato Esperado</CardTitle>
              <CardDescription>
                {mode === "excel"
                  ? "Uma linha por viagem, clientes sao extraidos pelo CPF"
                  : "Estrutura do JSON de importacao"}
              </CardDescription>
            </CardHeader>
            <CardContent className="text-sm space-y-4">
              {mode === "excel" ? (
                <div>
                  <p className="text-muted-foreground mb-2">
                    Planilha unica com todas as colunas. CPF duplicado = mesmo cliente.
                  </p>
                  <ul className="list-disc list-inside text-muted-foreground space-y-1">
                    <li><code>nome</code> - Nome completo</li>
                    <li><code>cpf</code> - 11 digitos (unico por cliente)</li>
                    <li><code>email</code> - (opcional)</li>
                    <li><code>telefone</code> - (opcional)</li>
                    <li><code>reservationId</code> - ID da reserva</li>
                    <li><code>totalValue</code> - Valor em reais</li>
                    <li><code>returnDate</code> - Data de retorno</li>
                    <li><code>status</code> - PENDING ou COMPLETED</li>
                    <li><code>cashbackPercent</code> - Percentual (0-100)</li>
                  </ul>
                </div>
              ) : (
                <>
                  <div>
                    <h4 className="font-semibold mb-1">customers[]</h4>
                    <ul className="list-disc list-inside text-muted-foreground space-y-1">
                      <li><code>name</code> - Nome completo</li>
                      <li><code>cpf</code> - 11 digitos</li>
                      <li><code>email</code> - (opcional)</li>
                      <li><code>phone</code> - (opcional)</li>
                    </ul>
                  </div>
                  <div>
                    <h4 className="font-semibold mb-1">trips[]</h4>
                    <ul className="list-disc list-inside text-muted-foreground space-y-1">
                      <li><code>reservationId</code> - ID da reserva</li>
                      <li><code>customerCpf</code> - CPF do cliente</li>
                      <li><code>totalValue</code> - Valor em reais</li>
                      <li><code>returnDate</code> - Data ISO</li>
                      <li><code>status</code> - PENDING ou COMPLETED</li>
                      <li><code>cashbackPercent</code> - Percentual</li>
                    </ul>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Loading Card */}
          {loading && (
            <Card className="border-primary">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  Processando importacao...
                </CardTitle>
                <CardDescription>
                  {statusText || "Isso pode levar alguns minutos para arquivos grandes"}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Progress value={progress} />
                <p className="text-center text-sm font-medium">{progress}% concluído</p>
                <div className="text-sm text-muted-foreground space-y-1 text-center">
                  <p>Fragmentando dados para evitar timeouts...</p>
                  <p>Mantendo sua sessão ativa...</p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Result Card */}
          {!loading && result && (
            <Card
              className={result.success ? "border-green-500" : "border-red-500"}
            >
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {result.success ? (
                    <CheckCircle className="h-5 w-5 text-green-500" />
                  ) : (
                    <XCircle className="h-5 w-5 text-red-500" />
                  )}
                  {result.message}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {result.success && result.stats && (
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="flex justify-between">
                      <span>Clientes criados:</span>
                      <Badge variant="secondary">
                        {result.stats.customersCreated}
                      </Badge>
                    </div>
                    <div className="flex justify-between">
                      <span>Clientes atualizados:</span>
                      <Badge variant="secondary">
                        {result.stats.customersUpdated}
                      </Badge>
                    </div>
                    <div className="flex justify-between">
                      <span>Viagens criadas:</span>
                      <Badge variant="secondary">
                        {result.stats.tripsCreated}
                      </Badge>
                    </div>
                    <div className="flex justify-between">
                      <span>Transacoes criadas:</span>
                      <Badge variant="secondary">
                        {result.stats.transactionsCreated}
                      </Badge>
                    </div>
                    <div className="flex justify-between col-span-2">
                      <span>Total de pontos adicionados:</span>
                      <Badge>{result.stats.totalPointsAdded}</Badge>
                    </div>
                  </div>
                )}
                {result.errors && result.errors.length > 0 && (
                  <ul className="text-sm text-red-500 space-y-1">
                    {result.errors.map((error, i) => (
                      <li key={i}>{error}</li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
