import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Capacitor } from "@capacitor/core";
import {
  CapacitorPluginMlKitTextRecognition,
  type TextDetectionResult,
} from "@pantrist/capacitor-plugin-ml-kit-text-recognition";
import { BrowserMultiFormatReader } from "@zxing/browser";
import { BarcodeFormat, DecodeHintType } from "@zxing/library";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Camera, CheckCircle2, Gauge, Keyboard, Loader2, ScanLine, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  findMachineByCode,
  findMachineById,
  findMachineByQr,
  saveReading,
} from "@/lib/horimeter.functions";

type CaptureSearch = {
  tipo: "inicio" | "fim";
  machineId?: string;
};

type Machine = {
  id: string;
  codigo: string;
  qr_token: string;
  nome: string;
  modelo: string | null;
  ultimo_horimetro: number | string | null;
  ativo: boolean;
  local?: boolean;
};

type OcrResult = {
  ok: boolean;
  valor?: number;
  confianca?: number;
  observacoes?: string;
  error?: string;
};

const barcodeHints = new Map();
barcodeHints.set(DecodeHintType.TRY_HARDER, true);
barcodeHints.set(DecodeHintType.POSSIBLE_FORMATS, [
  BarcodeFormat.QR_CODE,
  BarcodeFormat.CODE_128,
  BarcodeFormat.CODE_39,
  BarcodeFormat.CODE_93,
  BarcodeFormat.ITF,
  BarcodeFormat.EAN_13,
  BarcodeFormat.EAN_8,
  BarcodeFormat.UPC_A,
  BarcodeFormat.UPC_E,
  BarcodeFormat.DATA_MATRIX,
]);
const barcodeReader = new BrowserMultiFormatReader(barcodeHints);

export const Route = createFileRoute("/_authenticated/capture")({
  validateSearch: (search: Record<string, unknown>): CaptureSearch => ({
    tipo: search.tipo === "fim" ? "fim" : "inicio",
    machineId: typeof search.machineId === "string" ? search.machineId : undefined,
  }),
  component: CapturePage,
});

function fileToImage(file: File) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = reject;
    img.src = url;
  });
}

async function fileToCompressedDataUrl(file: File) {
  const img = await fileToImage(file);
  const maxSide = 2200;
  const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(img.width * scale));
  canvas.height = Math.max(1, Math.round(img.height * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Não foi possível preparar a imagem.");
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.92);
}

async function detectBarcodeFromFile(file: File) {
  const image = await fileToImage(file);
  return barcodeReader.decode(image).getText();
}

function normalizeOcrText(value: string) {
  return value
    .toUpperCase()
    .replace(/[OQD]/g, "0")
    .replace(/[IL|!]/g, "1")
    .replace(/Z/g, "2")
    .replace(/S/g, "5")
    .replace(/[BG]/g, "8")
    .replace(/[^0-9.,]/g, "");
}

function getOcrRows(result: TextDetectionResult) {
  const rows = result.blocks
    .flatMap((block) => block.lines)
    .map((line) => ({
      text: line.elements.map((element) => element.text).join(""),
      top: line.boundingBox.top,
      left: line.boundingBox.left,
      height: Math.max(1, line.boundingBox.bottom - line.boundingBox.top),
    }))
    .sort((a, b) => a.top - b.top || a.left - b.left);

  const grouped: Array<{ text: string; top: number; height: number }> = [];
  for (const row of rows) {
    const current = grouped.find(
      (group) => Math.abs(group.top - row.top) <= Math.max(group.height, row.height) * 0.65,
    );
    if (current) {
      current.text += row.text;
    } else {
      grouped.push({ text: row.text, top: row.top, height: row.height });
    }
  }

  return [
    ...result.text.split(/\r?\n/),
    ...rows.map((row) => row.text),
    ...grouped.map((row) => row.text),
    rows.map((row) => row.text).join(""),
  ];
}

function parseHorimeterValue(result: TextDetectionResult, previousValue: number | null) {
  const candidates: Array<{ value: number; score: number }> = [];
  for (const rawLine of getOcrRows(result)) {
    const line = normalizeOcrText(rawLine);
    const matches = line.match(/\d{3,8}(?:[.,]\d{1,2})?/g) ?? [];
    for (const match of matches) {
      const value = Number(match.replace(",", "."));
      if (!Number.isFinite(value) || value <= 0 || value > 9_999_999) continue;

      const integerDigits = match.split(/[.,]/)[0].length;
      let score = integerDigits >= 4 && integerDigits <= 7 ? 5 : 1;
      if (/[.,]\d{1,2}$/.test(match)) score += 3;
      if (normalizeOcrText(rawLine) === match) score += 3;
      if (previousValue != null) {
        if (value >= previousValue) score += 4;
        score -= Math.min(Math.abs(value - previousValue) / 10_000, 3);
      }
      candidates.push({ value, score });
    }
  }

  return candidates.sort((a, b) => b.score - a.score)[0]?.value ?? null;
}

async function createOcrVariants(imageDataUrl: string) {
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const element = new Image();
    element.onload = () => resolve(element);
    element.onerror = reject;
    element.src = imageDataUrl;
  });
  const variants = [imageDataUrl];

  for (const inverted of [false, true]) {
    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) continue;
    ctx.drawImage(image, 0, 0);
    const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);

    for (let index = 0; index < pixels.data.length; index += 4) {
      const gray =
        pixels.data[index] * 0.299 +
        pixels.data[index + 1] * 0.587 +
        pixels.data[index + 2] * 0.114;
      const contrasted = Math.max(0, Math.min(255, (gray - 128) * 2.2 + 128));
      const value = inverted ? 255 - contrasted : contrasted;
      pixels.data[index] = value;
      pixels.data[index + 1] = value;
      pixels.data[index + 2] = value;
    }

    ctx.putImageData(pixels, 0, 0);
    variants.push(canvas.toDataURL("image/jpeg", 0.94));
  }

  return variants;
}

async function readHorimeterOnDevice(imageDataUrl: string, previousValue: number | null) {
  if (!Capacitor.isNativePlatform()) {
    throw new Error("A leitura automática local está disponível no aplicativo Android.");
  }

  const variants = await createOcrVariants(imageDataUrl);
  const results: TextDetectionResult[] = [];
  let value: number | null = null;

  for (const variant of variants) {
    const result = await CapacitorPluginMlKitTextRecognition.detectText({
      base64Image: variant.slice(variant.indexOf(",") + 1),
      rotation: 0,
    });
    results.push(result);
    value = parseHorimeterValue(result, previousValue);
    if (value != null) break;
  }

  if (value == null) {
    const recognized = results
      .map((result) => result.text.trim())
      .filter(Boolean)
      .join(" | ");
    throw new Error(
      recognized
        ? `Li "${recognized.slice(0, 80)}", mas não encontrei o horímetro. Fotografe somente o visor.`
        : "Não encontrei texto. Fotografe somente o visor, mais perto e sem reflexo.",
    );
  }

  return {
    ok: true,
    valor: value,
    confianca: 0.8,
    observacoes: results
      .map((result) => result.text)
      .filter(Boolean)
      .join(" | "),
  } satisfies OcrResult;
}

function CapturePage() {
  const search = Route.useSearch();
  const lookupQr = useServerFn(findMachineByQr);
  const lookupCode = useServerFn(findMachineByCode);
  const lookupById = useServerFn(findMachineById);
  const persistReading = useServerFn(saveReading);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanTimerRef = useRef<number | null>(null);
  const scanInProgressRef = useRef(false);
  const horimeterRef = useRef<HTMLDivElement>(null);
  const confirmedInputRef = useRef<HTMLInputElement>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [manualCode, setManualCode] = useState("");
  const [machine, setMachine] = useState<Machine | null>(null);
  const [photoDataUrl, setPhotoDataUrl] = useState("");
  const [photoPreview, setPhotoPreview] = useState("");
  const [ocr, setOcr] = useState<OcrResult | null>(null);
  const [confirmedValue, setConfirmedValue] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState("");

  const title = search.tipo === "fim" ? "Finalizar leitura" : "Iniciar leitura";
  const confidenceLabel = useMemo(() => {
    if (!ocr?.confianca && ocr?.confianca !== 0) return "";
    return `${Math.round(ocr.confianca * 100)}% de confiança`;
  }, [ocr]);

  useEffect(() => {
    if (!search.machineId) return;
    let cancelled = false;
    setLoading("machine");
    lookupById({ data: { id: search.machineId } })
      .then((result: any) => {
        if (cancelled) return;
        if (result.found && result.machine?.ativo) setMachine(result.machine);
      })
      .catch((error: Error) => toast.error(error.message))
      .finally(() => {
        if (!cancelled) setLoading("");
      });
    return () => {
      cancelled = true;
    };
  }, [lookupById, search.machineId]);

  useEffect(() => {
    return () => stopCamera();
  }, []);

  async function startCamera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      });
      streamRef.current = stream;

      const video = videoRef.current;
      if (!video) {
        throw new Error("Não foi possível preparar a visualização da câmera.");
      }

      video.srcObject = stream;
      setCameraActive(true);
      await video.play();
      scanTimerRef.current = window.setInterval(() => {
        void scanVideoFrame(false);
      }, 500);
    } catch (error: any) {
      stopCamera();
      toast.error(error.message ?? "Não foi possível abrir a câmera.");
    }
  }

  function stopCamera() {
    if (scanTimerRef.current !== null) {
      window.clearInterval(scanTimerRef.current);
      scanTimerRef.current = null;
    }
    scanInProgressRef.current = false;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
  }

  async function scanVideoFrame(showNotFoundMessage = true) {
    if (!videoRef.current || videoRef.current.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
      if (showNotFoundMessage) toast.error("A câmera ainda está preparando a imagem.");
      return;
    }
    if (scanInProgressRef.current) return;

    scanInProgressRef.current = true;
    try {
      const code = barcodeReader.decode(videoRef.current).getText();
      stopCamera();
      await lookupMachine(code, "qr");
    } catch {
      if (showNotFoundMessage) {
        toast.error(
          "Nenhum código encontrado. Centralize o QR ou código de barras e tente novamente.",
        );
      }
    } finally {
      scanInProgressRef.current = false;
    }
  }

  async function lookupMachine(code: string, mode: "qr" | "code" = "qr") {
    const cleaned = code.trim();
    if (!cleaned) return;
    setLoading("machine");
    try {
      const result: any =
        mode === "qr"
          ? await lookupQr({ data: { qr_token: cleaned } })
          : await lookupCode({ data: { codigo: cleaned } });
      if (!result.found) {
        setMachine(null);
        toast.error("Máquina não cadastrada para este código.");
        return;
      }
      if (!result.ativo) {
        toast.error("Máquina inativa.");
        return;
      }
      setPhotoDataUrl("");
      setPhotoPreview("");
      setOcr(null);
      setConfirmedValue("");
      setManualCode(cleaned);
      setMachine(result.machine);
      toast.success(`${result.machine.nome} encontrada.`);
      window.setTimeout(() => {
        horimeterRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 100);
    } catch (error: any) {
      toast.error(error.message ?? "Erro ao buscar máquina.");
    } finally {
      setLoading("");
    }
  }

  async function handleQrImage(file: File | undefined) {
    if (!file) return;
    setLoading("machine");
    try {
      const code = await detectBarcodeFromFile(file);
      if (!code) throw new Error("Nenhum código encontrado na imagem.");
      await lookupMachine(code, "qr");
    } catch {
      toast.error("Nenhum QR ou código de barras foi encontrado na imagem.");
    } finally {
      setLoading("");
    }
  }

  async function handlePhoto(file: File | undefined) {
    if (!file) return;
    setLoading("photo");
    try {
      const dataUrl = await fileToCompressedDataUrl(file);
      setPhotoDataUrl(dataUrl);
      setPhotoPreview(dataUrl);
      setOcr(null);
      setConfirmedValue("");
      if (machine) await runOcrWithDataUrl(dataUrl);
    } catch (error: any) {
      toast.error(error.message ?? "Erro ao preparar foto.");
    } finally {
      setLoading("");
    }
  }

  async function runOcrWithDataUrl(imageDataUrl: string) {
    setLoading("ocr");
    try {
      const previousValue =
        machine?.ultimo_horimetro == null ? null : Number(machine.ultimo_horimetro);
      const result = await readHorimeterOnDevice(imageDataUrl, previousValue);
      setOcr(result);
      setConfirmedValue(String(result.valor));
      toast.success("Horímetro identificado.");
      window.setTimeout(() => {
        confirmedInputRef.current?.focus();
        confirmedInputRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 100);
    } catch (error: any) {
      setOcr(null);
      toast.error(error.message ?? "Erro na leitura automática.");
    } finally {
      setLoading("");
    }
  }

  async function save() {
    if (!machine || !photoDataUrl || !confirmedValue) return;
    const value = Number(String(confirmedValue).replace(",", "."));
    if (!Number.isFinite(value) || value <= 0) {
      toast.error("Informe um horímetro válido.");
      return;
    }
    setLoading("save");
    try {
      if (machine.id.startsWith("local:")) {
        const pending = JSON.parse(localStorage.getItem("field-meter-pending-readings") ?? "[]");
        pending.push({
          id: crypto.randomUUID(),
          machineCode: machine.codigo,
          machineQrToken: machine.qr_token,
          machineName: machine.nome,
          tipo: search.tipo,
          valorOcr: ocr?.ok ? (ocr.valor ?? null) : null,
          valorConfirmado: value,
          confianca: ocr?.ok ? (ocr.confianca ?? null) : null,
          observacoes: notes,
          clientCreatedAt: new Date().toISOString(),
        });
        localStorage.setItem("field-meter-pending-readings", JSON.stringify(pending));
        toast.success("Leitura confirmada no aparelho. Sincronização pendente.");
        return;
      }

      await persistReading({
        data: {
          machineId: machine.id,
          tipo: search.tipo,
          valorOcr: ocr?.ok ? (ocr.valor ?? null) : null,
          valorConfirmado: value,
          confianca: ocr?.ok ? (ocr.confianca ?? null) : null,
          imageDataUrl: photoDataUrl,
          lat: null,
          lng: null,
          gpsAccuracy: null,
          siteSugeridoId: null,
          siteConfirmadoId: null,
          observacoes: notes,
          clientCreatedAt: new Date().toISOString(),
          deviceId: localStorage.getItem("field-meter-device-id") ?? crypto.randomUUID(),
        },
      });
      toast.success("Leitura salva.");
    } catch (error: any) {
      toast.error(error.message ?? "Erro ao salvar leitura.");
    } finally {
      setLoading("");
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <Button asChild variant="ghost" size="sm" className="mb-2">
          <Link to="/">Voltar</Link>
        </Button>
        <h1 className="text-2xl font-bold">{title}</h1>
        <p className="text-sm text-muted-foreground">
          Código da máquina, foto do painel e leitura automática do dia.
        </p>
      </div>

      <Card className="p-4 space-y-4">
        <div className="flex items-center gap-2 font-semibold">
          <ScanLine className="size-5 text-primary" />
          Máquina
        </div>
        <div className={cameraActive ? "space-y-3" : "hidden"}>
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="aspect-video w-full rounded-md bg-black object-cover"
          />
          <div className="flex items-center gap-3">
            <div className="flex flex-1 items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin text-primary" />
              Lendo QR ou código de barras...
            </div>
            <Button variant="outline" onClick={stopCamera}>
              Fechar câmera
            </Button>
          </div>
        </div>
        {!cameraActive && (
          <div className="grid gap-2 sm:grid-cols-2">
            <Button onClick={startCamera}>
              <Camera className="size-4 mr-2" />
              Abrir câmera
            </Button>
            <Button asChild variant="outline">
              <Label className="cursor-pointer">
                <Upload className="size-4 mr-2" />
                Imagem do código
                <Input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => handleQrImage(e.target.files?.[0])}
                />
              </Label>
            </Button>
          </div>
        )}
        <div className="flex gap-2">
          <div className="flex-1">
            <Label htmlFor="machine-code">Código manual</Label>
            <Input
              id="machine-code"
              value={manualCode}
              onChange={(event) => setManualCode(event.target.value)}
              placeholder="Ex: 0016 ou FROTA 16"
            />
          </div>
          <Button
            className="mt-6"
            variant="secondary"
            disabled={loading === "machine"}
            onClick={() => lookupMachine(manualCode, "qr")}
          >
            {loading === "machine" ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Keyboard className="size-4" />
            )}
          </Button>
        </div>
        {machine && (
          <div className="rounded-md border border-border bg-accent/40 p-3">
            <div className="flex items-center justify-between gap-3">
              <div className="font-semibold">{machine.nome}</div>
              {machine.id.startsWith("local:") && (
                <span className="text-xs text-muted-foreground">Catálogo local</span>
              )}
            </div>
            <div className="text-sm text-muted-foreground">
              Barra {machine.qr_token} · {machine.modelo ?? "Sem modelo"} · Último:{" "}
              <span className="digit-display">{machine.ultimo_horimetro ?? "-"}</span> h
            </div>
          </div>
        )}
      </Card>

      <Card ref={horimeterRef} className="scroll-mt-4 p-4 space-y-4">
        <div className="flex items-center gap-2 font-semibold">
          <Gauge className="size-5 text-primary" />
          Horímetro
        </div>
        <Button asChild variant="outline" className="w-full" disabled={!machine}>
          <Label className="cursor-pointer">
            <Camera className="size-4 mr-2" />
            {machine ? `Fotografar horímetro de ${machine.nome}` : "Identifique a máquina primeiro"}
            <Input
              type="file"
              accept="image/*"
              capture="environment"
              disabled={!machine}
              className="hidden"
              onChange={(e) => handlePhoto(e.target.files?.[0])}
            />
          </Label>
        </Button>
        {photoPreview && (
          <img
            src={photoPreview}
            alt="Foto do horímetro"
            className="max-h-72 w-full rounded-md object-cover"
          />
        )}
        {loading === "ocr" && (
          <div className="flex items-center justify-center gap-2 py-3 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin text-primary" />
            Identificando horímetro...
          </div>
        )}
        {ocr?.ok && (
          <div className="rounded-md border border-primary/40 bg-primary/10 p-4">
            <div className="text-xs uppercase text-muted-foreground">Horímetro do dia</div>
            <div className="digit-display text-4xl font-bold">{ocr.valor}</div>
            <div className="text-sm text-muted-foreground">{confidenceLabel}</div>
          </div>
        )}
        <div>
          <Label htmlFor="confirmed">Confirmar horímetro</Label>
          <Input
            ref={confirmedInputRef}
            id="confirmed"
            inputMode="decimal"
            value={confirmedValue}
            onChange={(event) => setConfirmedValue(event.target.value)}
            placeholder="Valor final conferido"
          />
        </div>
        <div>
          <Label htmlFor="notes">Observações</Label>
          <Textarea id="notes" value={notes} onChange={(event) => setNotes(event.target.value)} />
        </div>
        <Button
          className="w-full"
          disabled={!machine || !photoDataUrl || !confirmedValue || loading === "save"}
          onClick={save}
        >
          {loading === "save" ? (
            <Loader2 className="size-4 mr-2 animate-spin" />
          ) : (
            <CheckCircle2 className="size-4 mr-2" />
          )}
          Confirmar leitura
        </Button>
      </Card>
    </div>
  );
}
