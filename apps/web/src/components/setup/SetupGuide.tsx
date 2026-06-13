import { Button } from "@repo/ui/components/button";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@repo/ui/components/dialog";
import { Input } from "@repo/ui/components/input";
import { Label } from "@repo/ui/components/label";
import {
  Building2Icon,
  Globe2Icon,
  ReceiptIcon,
  ListFilterIcon,
  ArrowRightIcon,
  ArrowLeftIcon,
  Loader2Icon,
  CheckCircle2Icon,
  AlertCircleIcon,
  CheckIcon,
  CoinsIcon,
  ShieldCheckIcon,
  SparklesIcon,
} from "lucide-react";
import * as React from "react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { entityList, entitySave } from "#/lib/entity-capabilities";

interface SetupGuideProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: string;
  companyName: string;
  onCompleted: () => void;
}

interface LegalProfile {
  legalName: string;
  taxNumber: string;
  vatId: string;
  bankName: string;
  bankBic: string;
  bankIban: string;
}

export function SetupGuide({
  open,
  onOpenChange,
  companyId,
  companyName,
  onCompleted,
}: SetupGuideProps) {
  const { i18n } = useTranslation("ui");
  const isDe = i18n.language?.startsWith("de");

  // Step state
  const [step, setStep] = useState(1);

  // Step 1 Form state
  const [profile, setProfile] = useState<LegalProfile>(() => ({
    legalName: companyName || "",
    taxNumber: "",
    vatId: "",
    bankName: "",
    bankBic: "",
    bankIban: "",
  }));

  const [errors, setErrors] = useState<Partial<Record<keyof LegalProfile, string>>>({});
  const [touched, setTouched] = useState<Partial<Record<keyof LegalProfile, boolean>>>({});

  // Step 2 Country selection state
  const [countryCode, setCountryCode] = useState<"DE" | "AT">("DE");

  // Step 4 Sequences confirmation state
  const [sequences, setSequences] = useState([
    {
      key: "RE",
      nameDe: "Ausgangsrechnungen",
      nameEn: "Sales Invoices",
      prefix: "RE-",
      start: "1",
    },
    { key: "AN", nameDe: "Angebote", nameEn: "Offers / Quotes", prefix: "AN-", start: "1" },
    { key: "LI", nameDe: "Lieferscheine", nameEn: "Delivery Notes", prefix: "LI-", start: "1" },
    {
      key: "AU",
      nameDe: "Auftragsbestätigungen",
      nameEn: "Order Confirmations",
      prefix: "AU-",
      start: "1",
    },
    { key: "GU", nameDe: "Gutschriften", nameEn: "Credit Notes", prefix: "GU-", start: "1" },
  ]);

  // Step 5 Progress state
  const [installStatus, setInstallStatus] = useState<"idle" | "running" | "success" | "error">(
    "idle",
  );
  const [errorMessage, setErrorMessage] = useState("");
  const [progressStep, setProgressStep] = useState(0);

  // Validations
  const validateField = (field: keyof LegalProfile, value: string): string => {
    const trimmed = value.trim();
    if (field === "legalName") {
      if (!trimmed) return isDe ? "Rechtlicher Name ist erforderlich." : "Legal name is required.";
      if (trimmed.length < 2)
        return isDe
          ? "Name muss mindestens 2 Zeichen lang sein."
          : "Name must be at least 2 characters.";
    }
    if (field === "taxNumber") {
      if (!trimmed) return isDe ? "Steuernummer ist erforderlich." : "Tax number is required.";
      if (trimmed.length < 5) return isDe ? "Ungültige Steuernummer." : "Invalid tax number.";
    }
    if (field === "vatId") {
      if (!trimmed) return isDe ? "USt-IdNr. ist erforderlich." : "VAT ID is required.";
      const vatClean = trimmed.replace(/\s+/g, "").toUpperCase();
      if (countryCode === "DE") {
        if (!/^DE\d{9}$/.test(vatClean)) {
          return isDe
            ? "Deutsches Format erforderlich (z.B. DE123456789)."
            : "German format required (e.g. DE123456789).";
        }
      } else {
        if (!/^ATU\d{8}$/.test(vatClean)) {
          return isDe
            ? "Österreichisches Format erforderlich (z.B. ATU12345678)."
            : "Austrian format required (e.g. ATU12345678).";
        }
      }
    }
    if (field === "bankName") {
      if (!trimmed) return isDe ? "Bankname ist erforderlich." : "Bank name is required.";
    }
    if (field === "bankBic") {
      if (!trimmed) return isDe ? "BIC ist erforderlich." : "BIC is required.";
      const bicClean = trimmed.replace(/\s+/g, "").toUpperCase();
      if (!/^[A-Z]{6}[A-Z0-9]{2,5}$/.test(bicClean)) {
        return isDe
          ? "Ungültiger BIC/SWIFT-Code (8 oder 11 Stellen)."
          : "Invalid BIC/SWIFT code (8 or 11 characters).";
      }
    }
    if (field === "bankIban") {
      if (!trimmed) return isDe ? "IBAN ist erforderlich." : "IBAN is required.";
      const ibanClean = trimmed.replace(/\s+/g, "").toUpperCase();
      if (countryCode === "DE" && ibanClean.length !== 22) {
        return isDe
          ? "Deutsche IBAN muss 22 Zeichen lang sein."
          : "German IBAN must be 22 characters.";
      }
      if (countryCode === "AT" && ibanClean.length !== 20) {
        return isDe
          ? "Österreichische IBAN muss 20 Zeichen lang sein."
          : "Austrian IBAN must be 20 characters.";
      }
      if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(ibanClean)) {
        return isDe ? "Ungültiges IBAN-Format." : "Invalid IBAN format.";
      }
    }
    return "";
  };

  const handleBlur = (field: keyof LegalProfile) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
    const error = validateField(field, profile[field]);
    setErrors((prev) => ({ ...prev, [field]: error }));
  };

  const handleChange = (field: keyof LegalProfile, val: string) => {
    setProfile((prev) => ({ ...prev, [field]: val }));
    if (touched[field]) {
      const error = validateField(field, val);
      setErrors((prev) => ({ ...prev, [field]: error }));
    }
  };

  const handleSequenceChange = (index: number, field: "prefix" | "start", val: string) => {
    setSequences((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: val };
      return updated;
    });
  };

  // Step navigation validation checks
  const isStep1Valid = () => {
    const errs = {
      legalName: validateField("legalName", profile.legalName),
      taxNumber: validateField("taxNumber", profile.taxNumber),
      vatId: validateField("vatId", profile.vatId),
      bankName: validateField("bankName", profile.bankName),
      bankBic: validateField("bankBic", profile.bankBic),
      bankIban: validateField("bankIban", profile.bankIban),
    };
    return !Object.values(errs).some((e) => e !== "");
  };

  const handleNext = () => {
    if (step === 1) {
      // Trigger all validations
      const errs = {
        legalName: validateField("legalName", profile.legalName),
        taxNumber: validateField("taxNumber", profile.taxNumber),
        vatId: validateField("vatId", profile.vatId),
        bankName: validateField("bankName", profile.bankName),
        bankBic: validateField("bankBic", profile.bankBic),
        bankIban: validateField("bankIban", profile.bankIban),
      };
      setErrors(errs);
      setTouched({
        legalName: true,
        taxNumber: true,
        vatId: true,
        bankName: true,
        bankBic: true,
        bankIban: true,
      });

      if (Object.values(errs).some((e) => e !== "")) {
        toast.error(
          isDe
            ? "Bitte korrigieren Sie die Fehler im Profil."
            : "Please correct the errors in the profile.",
        );
        return;
      }
    }
    if (step === 4) {
      setStep(5);
      void runInitialization();
      return;
    }
    setStep((prev) => prev + 1);
  };

  const handlePrev = () => {
    setStep((prev) => prev - 1);
  };

  const runInitialization = async () => {
    setInstallStatus("running");
    setProgressStep(1);

    try {
      // Task 1: PATCH Legal Profile
      await new Promise((r) => setTimeout(r, 800)); // nice feel
      await entitySave("company", companyId, {
        legalName: profile.legalName,
        taxNumber: profile.taxNumber,
        vatId: profile.vatId.replace(/\s+/g, "").toUpperCase(),
        bankName: profile.bankName,
        bankBic: profile.bankBic.replace(/\s+/g, "").toUpperCase(),
        bankIban: profile.bankIban.replace(/\s+/g, "").toUpperCase(),
        countryCode: countryCode,
      });

      setProgressStep(2);
      await new Promise((r) => setTimeout(r, 1000)); // nice visual feel for seeding

      // Task 2: POST Setup Initialize (Chart of accounts, tax codes/rules, warehouses, terms, categories)
      const initRes = await fetch("/api/setup/initialize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId,
          countryCode,
        }),
      });

      if (!initRes.ok) {
        throw new Error(
          (await initRes.text()) ||
            (isDe
              ? "Initialisierung des Kontenrahmens fehlgeschlagen"
              : "Failed to initialize standard chart of accounts"),
        );
      }

      const initData = await initRes.json();
      if (!initData.success) {
        throw new Error(
          initData.error || (isDe ? "Initialisierungsfehler" : "Initialization failed"),
        );
      }

      setProgressStep(3);
      await new Promise((r) => setTimeout(r, 800));

      // Task 3: Customize Sequences if changed from standard nextValue/prefix
      // Standard sequences were seeded. If user changed prefix or start, let's update them.
      // In the database initialization, the current year is used.
      const currentYear = new Date().getFullYear();
      for (const seq of sequences) {
        // Query to find if the sequence already exists to patch, otherwise insert
        // The default initialized has RE-, AN-, LI-, AU-, GU- for current year with start 1.
        // We fetch and check if they customized. If they did, we perform updates.
        const customStart = parseInt(seq.start, 10) || 1;
        if (seq.prefix !== `${seq.key}-` || customStart !== 1) {
          // Send PATCH to custom setup
          // Fetch existing to get the ID, or let's use the DB filter.
          // For simplicity and resilience, we can send a custom action or just use standard tenant POST/PATCH to sequence.
          // Since setup/initialize already seeds them, let's look up or let's just make a POST to API /api/data/numberSequence to update.
          // In base-ui we can query list and find the correct sequence id.
          try {
            const seqs = await entityList<{ numberSequenceId: string }>("numberSequence", {
              companyId,
              prefix: `${seq.key}-`,
              fiscalYear: String(currentYear),
            });
            const existingSeq = seqs[0];
            if (existingSeq) {
              await entitySave("numberSequence", existingSeq.numberSequenceId, {
                prefix: seq.prefix,
                nextValue: customStart,
              });
            }
          } catch (e) {
            console.error("Non-blocking failure: failed to customize prefix/start value: ", e);
          }
        }
      }

      setProgressStep(4);
      await new Promise((r) => setTimeout(r, 800));

      setProgressStep(5);
      await new Promise((r) => setTimeout(r, 600));

      setInstallStatus("success");
      toast.success(
        isDe ? "Einrichtung erfolgreich abgeschlossen!" : "Company setup completed successfully!",
      );
    } catch (err: any) {
      console.error(err);
      setInstallStatus("error");
      setErrorMessage(
        err.message ||
          (isDe ? "Ein unbekannter Fehler ist aufgetreten." : "An unknown error occurred."),
      );
    }
  };

  const resetWizard = () => {
    setStep(1);
    setInstallStatus("idle");
    setErrorMessage("");
    setProgressStep(0);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full max-w-3xl overflow-hidden rounded-3xl border border-hairline/80 bg-canvas p-0 text-ink shadow-2xl">
        {/* Sleek top header strip */}
        <div className="h-1.5 bg-gradient-to-r from-primary/30 via-primary to-primary-foreground" />

        <div className="p-6 md:p-8">
          {/* Stepper progress indicator (Steps 1-4, hides in Step 5 screen) */}
          {step < 5 && (
            <div className="mb-8">
              <div className="mb-3 flex items-center justify-between text-xs font-semibold tracking-wider text-ink-mute uppercase">
                <span>{isDe ? `Schritt ${step} von 4` : `Step ${step} of 4`}</span>
                <span className="font-bold text-primary">
                  {step === 1 && (isDe ? "Rechtliches Profil" : "Legal Profile")}
                  {step === 2 && (isDe ? "Land & Kontenrahmen" : "Country & Tax Standard")}
                  {step === 3 && (isDe ? "Konten- & Steuervorschau" : "Accounts & Taxes Preview")}
                  {step === 4 && (isDe ? "Nummernkreise bestätigen" : "Confirm Number Sequences")}
                </span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-canvas-soft">
                <div
                  className="h-full bg-primary transition-all duration-300 ease-out"
                  style={{ width: `${(step / 4) * 100}%` }}
                />
              </div>
            </div>
          )}

          {/* Step 1: Legal Profile */}
          {step === 1 && (
            <div className="space-y-6">
              <div className="space-y-1">
                <DialogTitle className="flex items-center gap-2 text-2xl font-bold tracking-tight text-ink">
                  <Building2Icon className="size-6 text-primary" />
                  {isDe ? "Rechtliches Profil" : "Legal Profile"}
                </DialogTitle>
                <DialogDescription className="text-sm text-ink-secondary">
                  {isDe
                    ? "Geben Sie die steuerlichen und finanziellen Daten für die Rechnungslegung Ihres Unternehmens an."
                    : "Enter the tax and financial details for your company's accounting."}
                </DialogDescription>
              </div>

              <div className="grid gap-6 rounded-2xl border border-hairline/50 bg-canvas-soft/40 p-6 backdrop-blur-sm md:grid-cols-2">
                {/* Left Side: Identity & Tax */}
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold tracking-wider text-primary uppercase">
                    {isDe ? "Stammdaten" : "Corporate Details"}
                  </h3>
                  <div className="grid gap-2">
                    <Label htmlFor="legalName">
                      {isDe ? "Rechtlicher Name" : "Legal Company Name"}
                    </Label>
                    <Input
                      id="legalName"
                      value={profile.legalName}
                      onChange={(e) => handleChange("legalName", e.target.value)}
                      onBlur={() => handleBlur("legalName")}
                      placeholder="z.B. ACME Holding GmbH"
                      className={
                        errors.legalName
                          ? "border-destructive focus-visible:ring-destructive/20"
                          : ""
                      }
                    />
                    {errors.legalName && touched.legalName && (
                      <span className="flex items-center gap-1 text-xs font-medium text-destructive">
                        <AlertCircleIcon className="size-3" /> {errors.legalName}
                      </span>
                    )}
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="taxNumber">{isDe ? "Steuernummer" : "Tax Number"}</Label>
                    <Input
                      id="taxNumber"
                      value={profile.taxNumber}
                      onChange={(e) => handleChange("taxNumber", e.target.value)}
                      onBlur={() => handleBlur("taxNumber")}
                      placeholder={isDe ? "z.B. 12/345/67890" : "e.g. 12/345/67890"}
                      className={
                        errors.taxNumber
                          ? "border-destructive focus-visible:ring-destructive/20"
                          : ""
                      }
                    />
                    {errors.taxNumber && touched.taxNumber && (
                      <span className="flex items-center gap-1 text-xs font-medium text-destructive">
                        <AlertCircleIcon className="size-3" /> {errors.taxNumber}
                      </span>
                    )}
                  </div>

                  <div className="grid gap-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="vatId">{isDe ? "USt-IdNr. (VAT ID)" : "VAT ID"}</Label>
                      <span className="font-mono text-[10px] text-ink-mute uppercase">
                        {countryCode === "DE" ? "DE + 9 Digits" : "ATU + 8 Digits"}
                      </span>
                    </div>
                    <Input
                      id="vatId"
                      value={profile.vatId}
                      onChange={(e) => handleChange("vatId", e.target.value)}
                      onBlur={() => handleBlur("vatId")}
                      placeholder={countryCode === "DE" ? "z.B. DE123456789" : "z.B. ATU12345678"}
                      className={
                        errors.vatId ? "border-destructive focus-visible:ring-destructive/20" : ""
                      }
                    />
                    {errors.vatId && touched.vatId && (
                      <span className="flex items-center gap-1 text-xs font-medium text-destructive">
                        <AlertCircleIcon className="size-3" /> {errors.vatId}
                      </span>
                    )}
                  </div>
                </div>

                {/* Right Side: Banking */}
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold tracking-wider text-primary uppercase">
                    {isDe ? "Bankverbindung" : "Bank Connection"}
                  </h3>
                  <div className="grid gap-2">
                    <Label htmlFor="bankName">{isDe ? "Name der Bank" : "Bank Name"}</Label>
                    <Input
                      id="bankName"
                      value={profile.bankName}
                      onChange={(e) => handleChange("bankName", e.target.value)}
                      onBlur={() => handleBlur("bankName")}
                      placeholder="z.B. Sparkasse München"
                      className={
                        errors.bankName
                          ? "border-destructive focus-visible:ring-destructive/20"
                          : ""
                      }
                    />
                    {errors.bankName && touched.bankName && (
                      <span className="flex items-center gap-1 text-xs font-medium text-destructive">
                        <AlertCircleIcon className="size-3" /> {errors.bankName}
                      </span>
                    )}
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="bankIban">IBAN</Label>
                    <Input
                      id="bankIban"
                      value={profile.bankIban}
                      onChange={(e) => handleChange("bankIban", e.target.value)}
                      onBlur={() => handleBlur("bankIban")}
                      placeholder="z.B. DE21 5005 0500..."
                      className={
                        errors.bankIban
                          ? "border-destructive focus-visible:ring-destructive/20"
                          : ""
                      }
                    />
                    {errors.bankIban && touched.bankIban && (
                      <span className="flex items-center gap-1 text-xs font-medium text-destructive">
                        <AlertCircleIcon className="size-3" /> {errors.bankIban}
                      </span>
                    )}
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="bankBic">{isDe ? "BIC / SWIFT-Code" : "BIC / SWIFT"}</Label>
                    <Input
                      id="bankBic"
                      value={profile.bankBic}
                      onChange={(e) => handleChange("bankBic", e.target.value)}
                      onBlur={() => handleBlur("bankBic")}
                      placeholder="z.B. WELADED1MUC"
                      className={
                        errors.bankBic ? "border-destructive focus-visible:ring-destructive/20" : ""
                      }
                    />
                    {errors.bankBic && touched.bankBic && (
                      <span className="flex items-center gap-1 text-xs font-medium text-destructive">
                        <AlertCircleIcon className="size-3" /> {errors.bankBic}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Secure compliance badge */}
              <div className="flex items-center gap-3 rounded-xl border border-primary/10 bg-primary/5 p-3.5 text-xs text-ink-secondary">
                <ShieldCheckIcon className="size-4 shrink-0 text-primary" />
                <p>
                  {isDe
                    ? "Diese Daten werden verschlüsselt auf deutschen Servern verarbeitet und sind DSGVO-konform gesichert."
                    : "This data is securely encrypted on German servers and stored in full GDPR compliance."}
                </p>
              </div>

              <div className="flex justify-end border-t border-hairline/80 pt-4">
                <Button
                  onClick={handleNext}
                  disabled={!isStep1Valid()}
                  className="h-10 gap-2 rounded-full px-5"
                >
                  {isDe ? "Weiter" : "Next"}
                  <ArrowRightIcon className="size-4" />
                </Button>
              </div>
            </div>
          )}

          {/* Step 2: Country Selection */}
          {step === 2 && (
            <div className="space-y-6">
              <div className="space-y-1">
                <DialogTitle className="flex items-center gap-2 text-2xl font-bold tracking-tight text-ink">
                  <Globe2Icon className="size-6 text-primary" />
                  {isDe ? "Land & Kontenrahmen" : "Country & Tax Standard"}
                </DialogTitle>
                <DialogDescription className="text-sm text-ink-secondary">
                  {isDe
                    ? "Wählen Sie das Steuerland für Ihr Unternehmen aus. Wir konfigurieren automatisch die richtigen Steuersätze und Sachkonten."
                    : "Select your company's fiscal country. We will configure the correct tax rates and chart of accounts automatically."}
                </DialogDescription>
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                {/* Germany Card */}
                <button
                  type="button"
                  onClick={() => setCountryCode("DE")}
                  className={`group relative flex h-64 flex-col justify-between rounded-3xl border p-6 text-left transition-all duration-300 outline-none ${
                    countryCode === "DE"
                      ? "border-primary bg-primary/[0.03] shadow-lg ring-2 ring-primary/20"
                      : "border-hairline bg-canvas hover:border-ink/20 hover:bg-canvas-soft/30 hover:shadow-sm"
                  }`}
                >
                  {countryCode === "DE" && (
                    <span className="absolute top-4 right-4 rounded-full bg-primary p-1 text-primary-foreground">
                      <CheckIcon className="size-3.5" />
                    </span>
                  )}

                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="flex size-11 items-center justify-center rounded-2xl border border-amber-500/20 bg-amber-500/10 text-lg font-bold text-amber-600 shadow-inner">
                        DE
                      </div>
                      <div>
                        <h4 className="font-bold text-ink transition-colors group-hover:text-primary">
                          Deutschland
                        </h4>
                        <span className="text-xs font-semibold tracking-wider text-ink-mute uppercase">
                          SKR03 Kontenrahmen
                        </span>
                      </div>
                    </div>

                    <p className="text-xs leading-relaxed text-ink-secondary">
                      {isDe
                        ? "Empfohlen für deutsche Kapital- und Personengesellschaften. Beinhaltet den Standardkontenrahmen SKR03 (Prozessgliederungsprinzip)."
                        : "Recommended for German corporations and partnerships. Includes the standard chart of accounts SKR03."}
                    </p>
                  </div>

                  <div className="w-full space-y-2.5 border-t border-hairline/60 pt-4">
                    <div className="flex items-center justify-between text-[11px] font-medium text-ink-secondary">
                      <span>{isDe ? "Regelsteuersatz" : "Standard Tax"}</span>
                      <span className="font-mono font-bold">19% USt</span>
                    </div>
                    <div className="flex items-center justify-between text-[11px] font-medium text-ink-secondary">
                      <span>{isDe ? "Ermäßigter Satz" : "Reduced Tax"}</span>
                      <span className="font-mono font-bold">7% USt</span>
                    </div>
                  </div>
                </button>

                {/* Austria Card */}
                <button
                  type="button"
                  onClick={() => setCountryCode("AT")}
                  className={`group relative flex h-64 flex-col justify-between rounded-3xl border p-6 text-left transition-all duration-300 outline-none ${
                    countryCode === "AT"
                      ? "border-primary bg-primary/[0.03] shadow-lg ring-2 ring-primary/20"
                      : "border-hairline bg-canvas hover:border-ink/20 hover:bg-canvas-soft/30 hover:shadow-sm"
                  }`}
                >
                  {countryCode === "AT" && (
                    <span className="absolute top-4 right-4 rounded-full bg-primary p-1 text-primary-foreground">
                      <CheckIcon className="size-3.5" />
                    </span>
                  )}

                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="flex size-11 items-center justify-center rounded-2xl border border-red-500/20 bg-red-500/10 text-lg font-bold text-red-600 shadow-inner">
                        AT
                      </div>
                      <div>
                        <h4 className="font-bold text-ink transition-colors group-hover:text-primary">
                          Österreich
                        </h4>
                        <span className="text-xs font-semibold tracking-wider text-ink-mute uppercase">
                          EKR Kontenrahmen
                        </span>
                      </div>
                    </div>

                    <p className="text-xs leading-relaxed text-ink-secondary">
                      {isDe
                        ? "Optimiert für österreichische Unternehmen. Beinhaltet den österreichischen Einheitskontenrahmen (EKR) laut Rechnungslegungsgesetz."
                        : "Optimized for Austrian businesses. Includes the Austrian unified chart of accounts (EKR) compliant with UGB."}
                    </p>
                  </div>

                  <div className="w-full space-y-2.5 border-t border-hairline/60 pt-4">
                    <div className="flex items-center justify-between text-[11px] font-medium text-ink-secondary">
                      <span>{isDe ? "Regelsteuersatz" : "Standard Tax"}</span>
                      <span className="font-mono font-bold">20% USt</span>
                    </div>
                    <div className="flex items-center justify-between text-[11px] font-medium text-ink-secondary">
                      <span>{isDe ? "Ermäßigte Sätze" : "Reduced Taxes"}</span>
                      <span className="font-mono font-bold">13% & 10% USt</span>
                    </div>
                  </div>
                </button>
              </div>

              <div className="flex justify-between border-t border-hairline/80 pt-4">
                <Button
                  variant="outline"
                  onClick={handlePrev}
                  className="h-10 gap-2 rounded-full px-5"
                >
                  <ArrowLeftIcon className="size-4" />
                  {isDe ? "Zurück" : "Back"}
                </Button>
                <Button onClick={handleNext} className="h-10 gap-2 rounded-full px-5">
                  {isDe ? "Weiter" : "Next"}
                  <ArrowRightIcon className="size-4" />
                </Button>
              </div>
            </div>
          )}

          {/* Step 3: Preview Accounts & Taxes */}
          {step === 3 && (
            <div className="space-y-6">
              <div className="space-y-1">
                <DialogTitle className="flex items-center gap-2 text-2xl font-bold tracking-tight text-ink">
                  <ReceiptIcon className="size-6 text-primary" />
                  {isDe ? "Konten & Steuern Vorschau" : "Accounts & Taxes Preview"}
                </DialogTitle>
                <DialogDescription className="text-sm text-ink-secondary">
                  {isDe
                    ? `Folgender vordefinierter Konten- und Steuerrahmen wird für ${
                        countryCode === "DE" ? "Deutschland (SKR03)" : "Österreich (EKR)"
                      } angelegt:`
                    : `The following chart of accounts and tax codes will be set up for ${
                        countryCode === "DE" ? "Germany (SKR03)" : "Austria (EKR)"
                      }:`}
                </DialogDescription>
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                {/* GL Accounts Panel */}
                <div className="flex h-[320px] flex-col rounded-2xl border border-hairline/70 bg-canvas-soft/50 p-5">
                  <div className="mb-3 flex items-center gap-2">
                    <CoinsIcon className="size-4 text-primary" />
                    <h3 className="text-sm font-semibold text-ink">
                      {isDe ? "Hauptkonten (Beispiel)" : "Core Accounts (Sample)"}
                    </h3>
                  </div>

                  <div className="flex-1 space-y-2 overflow-y-auto pr-1 font-mono text-[11px]">
                    {countryCode === "DE" ? (
                      <>
                        <div className="flex items-center justify-between rounded-lg border border-hairline/40 bg-canvas p-2">
                          <span className="font-bold text-primary">1200</span>
                          <span className="max-w-[150px] truncate text-ink-secondary">
                            Bank / Guthaben
                          </span>
                          <span className="rounded-md bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-bold text-emerald-600 uppercase">
                            Asset
                          </span>
                        </div>
                        <div className="flex items-center justify-between rounded-lg border border-hairline/40 bg-canvas p-2">
                          <span className="font-bold text-primary">1400</span>
                          <span className="max-w-[150px] truncate text-ink-secondary">
                            Forderungen a.L.L.
                          </span>
                          <span className="rounded-md bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-bold text-emerald-600 uppercase">
                            Asset
                          </span>
                        </div>
                        <div className="flex items-center justify-between rounded-lg border border-hairline/40 bg-canvas p-2">
                          <span className="font-bold text-primary">1600</span>
                          <span className="max-w-[150px] truncate text-ink-secondary">
                            Verbindlichkeiten a.L.L.
                          </span>
                          <span className="rounded-md bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-bold text-amber-600 uppercase">
                            Liability
                          </span>
                        </div>
                        <div className="flex items-center justify-between rounded-lg border border-hairline/40 bg-canvas p-2">
                          <span className="font-bold text-primary">8400</span>
                          <span className="max-w-[150px] truncate text-ink-secondary">
                            Erlöse 19% USt
                          </span>
                          <span className="rounded-md bg-blue-500/10 px-1.5 py-0.5 text-[9px] font-bold text-blue-600 uppercase">
                            Revenue
                          </span>
                        </div>
                        <div className="flex items-center justify-between rounded-lg border border-hairline/40 bg-canvas p-2">
                          <span className="font-bold text-primary">8300</span>
                          <span className="max-w-[150px] truncate text-ink-secondary">
                            Erlöse 7% USt
                          </span>
                          <span className="rounded-md bg-blue-500/10 px-1.5 py-0.5 text-[9px] font-bold text-blue-600 uppercase">
                            Revenue
                          </span>
                        </div>
                        <div className="flex items-center justify-between rounded-lg border border-hairline/40 bg-canvas p-2">
                          <span className="font-bold text-primary">3400</span>
                          <span className="max-w-[150px] truncate text-ink-secondary">
                            Wareneingang 19%
                          </span>
                          <span className="rounded-md bg-red-500/10 px-1.5 py-0.5 text-[9px] font-bold text-red-600 uppercase">
                            Expense
                          </span>
                        </div>
                        <div className="flex items-center justify-between rounded-lg border border-hairline/40 bg-canvas p-2">
                          <span className="font-bold text-primary">0400</span>
                          <span className="max-w-[150px] truncate text-ink-secondary">
                            Fahrzeuge / Fuhrpark
                          </span>
                          <span className="rounded-md bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-bold text-emerald-600 uppercase">
                            Asset
                          </span>
                        </div>
                        <div className="mt-1 border-t border-dashed border-hairline py-1 text-center text-[10px] text-ink-mute">
                          {isDe
                            ? "+ 150 weitere Standardkonten (SKR03)"
                            : "+ 150 other standard accounts (SKR03)"}
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="flex items-center justify-between rounded-lg border border-hairline/40 bg-canvas p-2">
                          <span className="font-bold text-primary">2800</span>
                          <span className="max-w-[150px] truncate text-ink-secondary">
                            Bank (Guthaben)
                          </span>
                          <span className="rounded-md bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-bold text-emerald-600 uppercase">
                            Asset
                          </span>
                        </div>
                        <div className="flex items-center justify-between rounded-lg border border-hairline/40 bg-canvas p-2">
                          <span className="font-bold text-primary">1400</span>
                          <span className="max-w-[150px] truncate text-ink-secondary">
                            Forderungen a.L.L.
                          </span>
                          <span className="rounded-md bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-bold text-emerald-600 uppercase">
                            Asset
                          </span>
                        </div>
                        <div className="flex items-center justify-between rounded-lg border border-hairline/40 bg-canvas p-2">
                          <span className="font-bold text-primary">1600</span>
                          <span className="max-w-[150px] truncate text-ink-secondary">
                            Verbindlichkeiten a.L.L.
                          </span>
                          <span className="rounded-md bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-bold text-amber-600 uppercase">
                            Liability
                          </span>
                        </div>
                        <div className="flex items-center justify-between rounded-lg border border-hairline/40 bg-canvas p-2">
                          <span className="font-bold text-primary">4000</span>
                          <span className="max-w-[150px] truncate text-ink-secondary">
                            Umsatzerlöse 20%
                          </span>
                          <span className="rounded-md bg-blue-500/10 px-1.5 py-0.5 text-[9px] font-bold text-blue-600 uppercase">
                            Revenue
                          </span>
                        </div>
                        <div className="flex items-center justify-between rounded-lg border border-hairline/40 bg-canvas p-2">
                          <span className="font-bold text-primary">4013</span>
                          <span className="max-w-[150px] truncate text-ink-secondary">
                            Umsatzerlöse 13%
                          </span>
                          <span className="rounded-md bg-blue-500/10 px-1.5 py-0.5 text-[9px] font-bold text-blue-600 uppercase">
                            Revenue
                          </span>
                        </div>
                        <div className="flex items-center justify-between rounded-lg border border-hairline/40 bg-canvas p-2">
                          <span className="font-bold text-primary">4010</span>
                          <span className="max-w-[150px] truncate text-ink-secondary">
                            Umsatzerlöse 10%
                          </span>
                          <span className="rounded-md bg-blue-500/10 px-1.5 py-0.5 text-[9px] font-bold text-blue-600 uppercase">
                            Revenue
                          </span>
                        </div>
                        <div className="flex items-center justify-between rounded-lg border border-hairline/40 bg-canvas p-2">
                          <span className="font-bold text-primary">5000</span>
                          <span className="max-w-[150px] truncate text-ink-secondary">
                            Wareneinsatz 20%
                          </span>
                          <span className="rounded-md bg-red-500/10 px-1.5 py-0.5 text-[9px] font-bold text-red-600 uppercase">
                            Expense
                          </span>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Tax Codes Panel */}
                <div className="flex h-[320px] flex-col rounded-2xl border border-hairline/70 bg-canvas-soft/50 p-5">
                  <div className="mb-3 flex items-center gap-2">
                    <ListFilterIcon className="size-4 text-primary" />
                    <h3 className="text-sm font-semibold text-ink">
                      {isDe ? "Steuerschlüssel & Sätze" : "Tax Codes & Rates"}
                    </h3>
                  </div>

                  <div className="flex-1 space-y-2 overflow-y-auto pr-1 font-mono text-[11px]">
                    {countryCode === "DE" ? (
                      <>
                        <div className="flex items-center justify-between rounded-lg border border-hairline/40 bg-canvas p-2">
                          <span className="font-bold text-primary">DE-U19</span>
                          <span className="max-w-[150px] truncate text-ink-secondary">
                            Umsatzsteuer 19%
                          </span>
                          <span className="rounded-md bg-primary/10 px-1.5 py-0.5 font-bold text-primary">
                            19.00%
                          </span>
                        </div>
                        <div className="flex items-center justify-between rounded-lg border border-hairline/40 bg-canvas p-2">
                          <span className="font-bold text-primary">DE-U7</span>
                          <span className="max-w-[150px] truncate text-ink-secondary">
                            Umsatzsteuer 7%
                          </span>
                          <span className="rounded-md bg-primary/10 px-1.5 py-0.5 font-bold text-primary">
                            7.00%
                          </span>
                        </div>
                        <div className="flex items-center justify-between rounded-lg border border-hairline/40 bg-canvas p-2">
                          <span className="font-bold text-primary">DE-V19</span>
                          <span className="max-w-[150px] truncate text-ink-secondary">
                            Vorsteuer 19%
                          </span>
                          <span className="rounded-md bg-primary/10 px-1.5 py-0.5 font-bold text-primary">
                            19.00%
                          </span>
                        </div>
                        <div className="flex items-center justify-between rounded-lg border border-hairline/40 bg-canvas p-2">
                          <span className="font-bold text-primary">DE-V7</span>
                          <span className="max-w-[150px] truncate text-ink-secondary">
                            Vorsteuer 7%
                          </span>
                          <span className="rounded-md bg-primary/10 px-1.5 py-0.5 font-bold text-primary">
                            7.00%
                          </span>
                        </div>
                        <div className="flex items-center justify-between rounded-lg border border-hairline/40 bg-canvas p-2">
                          <span className="font-bold text-primary">DE-IGL</span>
                          <span className="max-w-[150px] truncate text-ink-secondary">
                            Intrakomm. Lieferung
                          </span>
                          <span className="rounded-md bg-canvas-soft px-1.5 py-0.5 font-bold text-ink-secondary">
                            0.00%
                          </span>
                        </div>
                        <div className="flex items-center justify-between rounded-lg border border-hairline/40 bg-canvas p-2">
                          <span className="font-bold text-primary">DE-RC-19</span>
                          <span className="max-w-[150px] truncate text-ink-secondary">
                            Reverse Charge 19%
                          </span>
                          <span className="rounded-md bg-primary/10 px-1.5 py-0.5 font-bold text-primary">
                            19.00%
                          </span>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="flex items-center justify-between rounded-lg border border-hairline/40 bg-canvas p-2">
                          <span className="font-bold text-primary">AT-U20</span>
                          <span className="max-w-[150px] truncate text-ink-secondary">
                            Umsatzsteuer 20%
                          </span>
                          <span className="rounded-md bg-primary/10 px-1.5 py-0.5 font-bold text-primary">
                            20.00%
                          </span>
                        </div>
                        <div className="flex items-center justify-between rounded-lg border border-hairline/40 bg-canvas p-2">
                          <span className="font-bold text-primary">AT-U13</span>
                          <span className="max-w-[150px] truncate text-ink-secondary">
                            Umsatzsteuer 13%
                          </span>
                          <span className="rounded-md bg-primary/10 px-1.5 py-0.5 font-bold text-primary">
                            13.00%
                          </span>
                        </div>
                        <div className="flex items-center justify-between rounded-lg border border-hairline/40 bg-canvas p-2">
                          <span className="font-bold text-primary">AT-U10</span>
                          <span className="max-w-[150px] truncate text-ink-secondary">
                            Umsatzsteuer 10%
                          </span>
                          <span className="rounded-md bg-primary/10 px-1.5 py-0.5 font-bold text-primary">
                            10.00%
                          </span>
                        </div>
                        <div className="flex items-center justify-between rounded-lg border border-hairline/40 bg-canvas p-2">
                          <span className="font-bold text-primary">AT-V20</span>
                          <span className="max-w-[150px] truncate text-ink-secondary">
                            Vorsteuer 20%
                          </span>
                          <span className="rounded-md bg-primary/10 px-1.5 py-0.5 font-bold text-primary">
                            20.00%
                          </span>
                        </div>
                        <div className="flex items-center justify-between rounded-lg border border-hairline/40 bg-canvas p-2">
                          <span className="font-bold text-primary">AT-RC-20</span>
                          <span className="max-w-[150px] truncate text-ink-secondary">
                            Reverse Charge 20%
                          </span>
                          <span className="rounded-md bg-primary/10 px-1.5 py-0.5 font-bold text-primary">
                            20.00%
                          </span>
                        </div>
                        <div className="flex items-center justify-between rounded-lg border border-hairline/40 bg-canvas p-2">
                          <span className="font-bold text-primary">AT-IGL</span>
                          <span className="max-w-[150px] truncate text-ink-secondary">
                            Intrakomm. Lieferung
                          </span>
                          <span className="rounded-md bg-canvas-soft px-1.5 py-0.5 font-bold text-ink-secondary">
                            0.00%
                          </span>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex justify-between border-t border-hairline/80 pt-4">
                <Button
                  variant="outline"
                  onClick={handlePrev}
                  className="h-10 gap-2 rounded-full px-5"
                >
                  <ArrowLeftIcon className="size-4" />
                  {isDe ? "Zurück" : "Back"}
                </Button>
                <Button onClick={handleNext} className="h-10 gap-2 rounded-full px-5">
                  {isDe ? "Weiter" : "Next"}
                  <ArrowRightIcon className="size-4" />
                </Button>
              </div>
            </div>
          )}

          {/* Step 4: Default Sequences */}
          {step === 4 && (
            <div className="space-y-6">
              <div className="space-y-1">
                <DialogTitle className="flex items-center gap-2 text-2xl font-bold tracking-tight text-ink">
                  <SparklesIcon className="size-6 text-primary" />
                  {isDe ? "Standard-Nummernkreise" : "Default Number Sequences"}
                </DialogTitle>
                <DialogDescription className="text-sm text-ink-secondary">
                  {isDe
                    ? "Hier können Sie die Startwerte und Präfixe Ihrer Belege für das laufende Geschäftsjahr anpassen."
                    : "Adjust the starting values and prefixes for your company's documents for the current fiscal year."}
                </DialogDescription>
              </div>

              <div className="overflow-hidden rounded-2xl border border-hairline/70 bg-canvas-soft/40 shadow-inner">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-hairline/60 bg-canvas text-xs tracking-wider text-ink-mute uppercase">
                    <tr>
                      <th className="p-4">{isDe ? "Belegtyp" : "Document Type"}</th>
                      <th className="w-[160px] p-4">{isDe ? "Präfix" : "Prefix"}</th>
                      <th className="w-[140px] p-4">{isDe ? "Startwert" : "Starting Value"}</th>
                      <th className="hidden p-4 sm:table-cell">{isDe ? "Beispiel" : "Preview"}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-hairline/40">
                    {sequences.map((seq, index) => {
                      const sampleNum = String(seq.start).padStart(6, "0");
                      return (
                        <tr key={seq.key} className="hover:bg-canvas-soft/10">
                          <td className="p-4">
                            <span className="block font-semibold text-ink sm:inline">
                              {isDe ? seq.nameDe : seq.nameEn}
                            </span>
                            <span className="block font-mono text-[10px] text-ink-mute">
                              ID: {seq.key}-
                            </span>
                          </td>
                          <td className="p-3">
                            <Input
                              value={seq.prefix}
                              onChange={(e) =>
                                handleSequenceChange(index, "prefix", e.target.value)
                              }
                              className="h-8 rounded-lg font-mono text-xs"
                            />
                          </td>
                          <td className="p-3">
                            <Input
                              type="number"
                              min="1"
                              value={seq.start}
                              onChange={(e) => handleSequenceChange(index, "start", e.target.value)}
                              className="h-8 rounded-lg font-mono text-xs"
                            />
                          </td>
                          <td className="hidden p-4 sm:table-cell">
                            <span className="rounded-md border border-hairline/40 bg-canvas px-2.5 py-1 font-mono text-xs text-ink-secondary">
                              {seq.prefix}
                              {sampleNum}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-between border-t border-hairline/80 pt-4">
                <Button
                  variant="outline"
                  onClick={handlePrev}
                  className="h-10 gap-2 rounded-full px-5"
                >
                  <ArrowLeftIcon className="size-4" />
                  {isDe ? "Zurück" : "Back"}
                </Button>
                <Button
                  onClick={handleNext}
                  className="h-10 gap-2 rounded-full bg-primary px-6 font-bold text-primary-foreground shadow-lg shadow-primary/25 hover:bg-primary/90"
                >
                  {isDe ? "Einrichtung starten" : "Start Setup"}
                  <ArrowRightIcon className="size-4 animate-pulse" />
                </Button>
              </div>
            </div>
          )}

          {/* Step 5: Progress & Finalization */}
          {step === 5 && (
            <div className="space-y-8 py-4">
              {installStatus === "running" && (
                <div className="space-y-6 text-center">
                  <div className="flex flex-col items-center justify-center space-y-4">
                    <Loader2Icon className="size-12 animate-spin text-primary" />
                    <div className="space-y-1">
                      <DialogTitle className="text-xl font-bold text-ink">
                        {isDe ? "Ihr Workspace wird eingerichtet" : "Setting up your workspace"}
                      </DialogTitle>
                      <DialogDescription className="max-w-md text-sm text-ink-secondary">
                        {isDe
                          ? "Bitte schließen Sie dieses Fenster nicht. Die Datenbanktabellen und Steuerregeln werden generiert..."
                          : "Please do not close this window. Database configurations and tax rules are being initialized..."}
                      </DialogDescription>
                    </div>
                  </div>

                  {/* Checklist of actions */}
                  <div className="mx-auto max-w-md space-y-3.5 rounded-2xl border border-hairline/70 bg-canvas-soft/40 p-5 text-left text-sm font-medium">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        {progressStep > 1 ? (
                          <CheckCircle2Icon className="size-4 shrink-0 text-emerald-500" />
                        ) : progressStep === 1 ? (
                          <Loader2Icon className="size-4 shrink-0 animate-spin text-primary" />
                        ) : (
                          <div className="size-4 shrink-0 rounded-full border border-hairline" />
                        )}
                        <span
                          className={
                            progressStep > 1
                              ? "text-ink-mute line-through"
                              : progressStep === 1
                                ? "font-bold text-primary"
                                : "text-ink-secondary"
                          }
                        >
                          {isDe ? "Stammdaten abspeichern..." : "Saving corporate legal details..."}
                        </span>
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        {progressStep > 2 ? (
                          <CheckCircle2Icon className="size-4 shrink-0 text-emerald-500" />
                        ) : progressStep === 2 ? (
                          <Loader2Icon className="size-4 shrink-0 animate-spin text-primary" />
                        ) : (
                          <div className="size-4 shrink-0 rounded-full border border-hairline" />
                        )}
                        <span
                          className={
                            progressStep > 2
                              ? "text-ink-mute line-through"
                              : progressStep === 2
                                ? "font-bold text-primary"
                                : "text-ink-secondary"
                          }
                        >
                          {isDe
                            ? `Kontenrahmen (${countryCode === "DE" ? "SKR03" : "EKR"}) generieren...`
                            : `Seeding chart of accounts (${countryCode === "DE" ? "SKR03" : "EKR"})...`}
                        </span>
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        {progressStep > 3 ? (
                          <CheckCircle2Icon className="size-4 shrink-0 text-emerald-500" />
                        ) : progressStep === 3 ? (
                          <Loader2Icon className="size-4 shrink-0 animate-spin text-primary" />
                        ) : (
                          <div className="size-4 shrink-0 rounded-full border border-hairline" />
                        )}
                        <span
                          className={
                            progressStep > 3
                              ? "text-ink-mute line-through"
                              : progressStep === 3
                                ? "font-bold text-primary"
                                : "text-ink-secondary"
                          }
                        >
                          {isDe
                            ? "Nummernkreise registrieren..."
                            : "Registering default sequences..."}
                        </span>
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        {progressStep > 4 ? (
                          <CheckCircle2Icon className="size-4 shrink-0 text-emerald-500" />
                        ) : progressStep === 4 ? (
                          <Loader2Icon className="size-4 shrink-0 animate-spin text-primary" />
                        ) : (
                          <div className="size-4 shrink-0 rounded-full border border-hairline" />
                        )}
                        <span
                          className={
                            progressStep > 4
                              ? "text-ink-mute line-through"
                              : progressStep === 4
                                ? "font-bold text-primary"
                                : "text-ink-secondary"
                          }
                        >
                          {isDe
                            ? "Standard-Lager MAIN anlegen..."
                            : "Setting up standard MAIN warehouse..."}
                        </span>
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        {progressStep > 5 ? (
                          <CheckCircle2Icon className="size-4 shrink-0 text-emerald-500" />
                        ) : progressStep === 5 ? (
                          <Loader2Icon className="size-4 shrink-0 animate-spin text-primary" />
                        ) : (
                          <div className="size-4 shrink-0 rounded-full border border-hairline" />
                        )}
                        <span
                          className={
                            progressStep > 5
                              ? "text-ink-mute line-through"
                              : progressStep === 5
                                ? "font-bold text-primary"
                                : "text-ink-secondary"
                          }
                        >
                          {isDe
                            ? "Firmeneinstellungen aktualisieren..."
                            : "Activating company workspace..."}
                        </span>
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {installStatus === "success" && (
                <div className="mx-auto max-w-md space-y-6 text-center">
                  <div className="flex flex-col items-center space-y-3">
                    <div className="flex size-16 animate-bounce items-center justify-center rounded-full border border-emerald-500/20 bg-emerald-500/10 text-emerald-500 shadow-inner">
                      <CheckCircle2Icon className="size-10" />
                    </div>
                    <DialogTitle className="text-2xl font-bold tracking-tight text-ink">
                      {isDe ? "Einrichtung abgeschlossen!" : "Setup Completed!"}
                    </DialogTitle>
                    <DialogDescription className="text-sm leading-relaxed text-ink-secondary">
                      {isDe
                        ? `Herzlichen Glückwunsch! Die Firma ${profile.legalName} wurde erfolgreich initialisiert und ist ab sofort betriebsbereit.`
                        : `Congratulations! The company ${profile.legalName} has been initialized successfully and is ready for business.`}
                    </DialogDescription>
                  </div>

                  <div className="divide-y divide-hairline/40 rounded-2xl border border-hairline/60 bg-canvas p-4 text-left font-mono text-xs">
                    <div className="flex justify-between py-2.5">
                      <span className="text-ink-mute">
                        {isDe ? "Rechtlicher Name:" : "Legal Name:"}
                      </span>
                      <span className="max-w-[200px] truncate font-bold text-ink">
                        {profile.legalName}
                      </span>
                    </div>
                    <div className="flex justify-between py-2.5">
                      <span className="text-ink-mute">
                        {isDe ? "Steuergebiet:" : "Tax Territory:"}
                      </span>
                      <span className="font-bold text-ink">
                        {countryCode === "DE" ? "Deutschland (DE)" : "Österreich (AT)"}
                      </span>
                    </div>
                    <div className="flex justify-between py-2.5">
                      <span className="text-ink-mute">IBAN:</span>
                      <span className="font-mono font-bold text-ink">
                        {profile.bankIban.replace(/(.{4})/g, "$1 ")}
                      </span>
                    </div>
                  </div>

                  <div className="pt-2">
                    <Button
                      onClick={onCompleted}
                      className="h-11 w-full gap-2 rounded-full bg-primary text-sm font-bold text-primary-foreground shadow-lg shadow-primary/25 hover:bg-primary/90"
                    >
                      <SparklesIcon className="size-4 animate-spin" />
                      {isDe ? "Loslegen / Let's Go" : "Get Started"}
                    </Button>
                  </div>
                </div>
              )}

              {installStatus === "error" && (
                <div className="mx-auto max-w-md space-y-6 text-center">
                  <div className="flex flex-col items-center space-y-3">
                    <div className="flex size-16 items-center justify-center rounded-full border border-destructive/20 bg-destructive/10 text-destructive shadow-inner">
                      <AlertCircleIcon className="size-10" />
                    </div>
                    <DialogTitle className="text-2xl font-bold tracking-tight text-ink">
                      {isDe ? "Einrichtung fehlgeschlagen" : "Setup Failed"}
                    </DialogTitle>
                    <DialogDescription className="text-sm leading-relaxed text-ink-secondary">
                      {isDe
                        ? "Beim Konfigurieren der Firma ist ein Fehler aufgetreten. Bitte prüfen Sie die Details unten."
                        : "An error occurred during company configuration. Please review the details below."}
                    </DialogDescription>
                  </div>

                  <div className="max-h-[140px] overflow-y-auto rounded-2xl border border-destructive/25 bg-destructive/[0.03] p-4 text-left font-mono text-xs whitespace-pre-wrap text-destructive shadow-inner">
                    {errorMessage}
                  </div>

                  <div className="flex gap-3 pt-2">
                    <Button
                      variant="outline"
                      onClick={resetWizard}
                      className="h-11 flex-1 rounded-full border-hairline/80 text-sm font-semibold hover:bg-canvas-soft"
                    >
                      {isDe ? "Zurück & Korrigieren" : "Go Back & Edit"}
                    </Button>
                    <Button
                      onClick={() => void runInitialization()}
                      className="h-11 flex-1 rounded-full bg-primary text-sm font-semibold text-primary-foreground hover:bg-primary/90"
                    >
                      {isDe ? "Erneut versuchen" : "Retry Setup"}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
