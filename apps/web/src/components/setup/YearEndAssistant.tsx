import { Button } from "@repo/ui/components/button";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@repo/ui/components/dialog";
import { Label } from "@repo/ui/components/label";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@repo/ui/components/select";
import {
  CalendarDaysIcon,
  HelpCircleIcon,
  Loader2Icon,
  CheckCircle2Icon,
  AlertTriangleIcon,
  ArrowRightIcon,
  SparklesIcon,
  Undo2Icon,
} from "lucide-react";
import * as React from "react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

interface YearEndAssistantProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: string;
  companyName: string;
  onCompleted: () => void;
}

export function YearEndAssistant({
  open,
  onOpenChange,
  companyId,
  companyName,
  onCompleted,
}: YearEndAssistantProps) {
  const { i18n } = useTranslation("ui");
  const isDe = i18n.language?.startsWith("de");

  const currentYear = new Date().getFullYear();
  const [targetYear, setTargetYear] = useState<number>(currentYear + 1);
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  const handleRollover = async () => {
    setStatus("loading");
    setErrorMessage("");

    try {
      // Small visual pause for smooth transitions
      await new Promise((r) => setTimeout(r, 1200));

      const res = await fetch("/api/setup/year-end", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId,
          fiscalYear: targetYear,
        }),
      });

      if (!res.ok) {
        throw new Error(
          (await res.text()) ||
            (isDe
              ? "Der Jahreswechsel konnte nicht durchgeführt werden."
              : "Fiscal year rollover failed."),
        );
      }

      const data = await res.json();
      if (!data.success) {
        throw new Error(
          data.error || (isDe ? "Jahreswechsel fehlgeschlagen." : "Rollover failed."),
        );
      }

      setStatus("success");
      toast.success(
        isDe
          ? `Jahreswechsel für ${targetYear} erfolgreich durchgeführt!`
          : `Year-end rollover to ${targetYear} successfully completed!`,
      );
    } catch (err: any) {
      console.error(err);
      setStatus("error");
      setErrorMessage(
        err.message ||
          (isDe ? "Ein unerwarteter Fehler ist aufgetreten." : "An unexpected error occurred."),
      );
    }
  };

  const handleClose = () => {
    onOpenChange(false);
    // Reset state after transition has finished
    setTimeout(() => {
      setStatus("idle");
      setErrorMessage("");
    }, 300);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full max-w-lg overflow-hidden rounded-3xl border border-hairline/80 bg-canvas p-0 text-ink shadow-2xl">
        {/* Sleek top header strip */}
        <div className="h-1.5 bg-gradient-to-r from-amber-500/30 via-amber-500 to-amber-600" />

        <div className="p-6 md:p-8">
          {status === "idle" && (
            <div className="space-y-6">
              <div className="space-y-1">
                <DialogTitle className="flex items-center gap-2 text-2xl font-bold tracking-tight text-ink">
                  <CalendarDaysIcon className="size-6 animate-pulse text-amber-500" />
                  {isDe ? "Jahreswechsel-Assistent" : "Year-End Rollover Assistant"}
                </DialogTitle>
                <DialogDescription className="text-sm text-ink-secondary">
                  {isDe
                    ? `Schließen Sie das laufende Geschäftsjahr ab und bereiten Sie ${companyName} auf das Folgejahr vor.`
                    : `Close the active fiscal year and prepare ${companyName} for the next fiscal period.`}
                </DialogDescription>
              </div>

              {/* Informative Rollover explanation block */}
              <div className="space-y-4 rounded-2xl border border-hairline/70 bg-canvas-soft/40 p-5">
                <div className="flex items-start gap-3">
                  <HelpCircleIcon className="mt-0.5 size-5 shrink-0 text-amber-500" />
                  <div className="space-y-1 text-xs leading-relaxed text-ink-secondary">
                    <h4 className="text-sm font-bold text-ink">
                      {isDe ? "Was bewirkt dieser Prozess?" : "What does this process do?"}
                    </h4>
                    <p>
                      {isDe
                        ? "1. Kopiert alle bestehenden Nummernkreis-Konfigurationen (wie Präfixe und Formate) in das neue Geschäftsjahr."
                        : "1. Clones all existing number sequence configurations (like prefixes and paddings) into the target fiscal year."}
                    </p>
                    <p>
                      {isDe
                        ? "2. Setzt alle Belegnummer-Zähler (Rechnungen RE-, Angebote AN-, Lieferscheine LI-) für das Zieljahr wieder auf 1 zurück."
                        : "2. Resets all document counters (Invoices RE-, Offers AN-, Delivery Notes LI-) back to 1 for the target year."}
                    </p>
                    <p>
                      {isDe
                        ? "3. Es werden KEINE bestehenden Buchungen, Rechnungen oder Buchhaltungsdaten des laufenden Jahres modifiziert oder gelöscht."
                        : "3. NO existing journal entries, invoices, or accounting records of the current year are modified or deleted."}
                    </p>
                  </div>
                </div>
              </div>

              {/* Target year selector */}
              <div className="flex items-center justify-between rounded-xl border border-hairline/60 bg-canvas p-4 shadow-sm">
                <div className="space-y-0.5">
                  <Label className="text-sm font-semibold text-ink">
                    {isDe ? "Ziel-Geschäftsjahr" : "Target Fiscal Year"}
                  </Label>
                  <p className="text-xs text-ink-mute">
                    {isDe
                      ? "Geschäftsjahr für den Nummernkreis-Rollover"
                      : "Fiscal year for the number sequence rollover"}
                  </p>
                </div>

                <Select
                  value={String(targetYear)}
                  onValueChange={(val) => setTargetYear(Number(val))}
                >
                  <SelectTrigger className="w-32 rounded-xl border-hairline/80 bg-canvas-soft/80 font-mono text-xs focus:border-primary">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border border-hairline bg-popover shadow-lg">
                    <SelectItem value={String(currentYear)}>{currentYear}</SelectItem>
                    <SelectItem value={String(currentYear + 1)}>{currentYear + 1}</SelectItem>
                    <SelectItem value={String(currentYear + 2)}>{currentYear + 2}</SelectItem>
                    <SelectItem value={String(currentYear + 3)}>{currentYear + 3}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Warning box */}
              <div className="flex items-center gap-3 rounded-xl border border-amber-500/10 bg-amber-500/5 p-4 text-xs text-ink-secondary">
                <AlertTriangleIcon className="size-4 shrink-0 text-amber-500" />
                <p>
                  {isDe
                    ? "Bitte stellen Sie sicher, dass für das angegebene Jahr noch keine Rechnungen oder Belege verbucht wurden."
                    : "Please ensure no documents or invoices have been posted in the target fiscal year yet."}
                </p>
              </div>

              <div className="flex justify-end gap-3 border-t border-hairline/80 pt-4">
                <Button
                  variant="outline"
                  onClick={handleClose}
                  className="h-10 rounded-full px-5 text-xs font-semibold"
                >
                  {isDe ? "Abbrechen" : "Cancel"}
                </Button>
                <Button
                  onClick={() => void handleRollover()}
                  className="h-10 gap-1.5 rounded-full bg-amber-500 px-6 text-xs font-bold text-white shadow-md shadow-amber-500/20 hover:bg-amber-600"
                >
                  {isDe ? "Rollover durchführen" : "Perform Rollover"}
                  <ArrowRightIcon className="size-4" />
                </Button>
              </div>
            </div>
          )}

          {status === "loading" && (
            <div className="space-y-4 py-8 text-center">
              <Loader2Icon className="mx-auto size-12 animate-spin text-amber-500" />
              <div className="space-y-1">
                <DialogTitle className="text-xl font-bold text-ink">
                  {isDe ? "Jahreswechsel wird ausgeführt" : "Executing Year-End Rollover"}
                </DialogTitle>
                <DialogDescription className="text-sm text-ink-secondary">
                  {isDe
                    ? `Nummernkreise für das Geschäftsjahr ${targetYear} werden generiert...`
                    : `Generating number sequences for fiscal period ${targetYear}...`}
                </DialogDescription>
              </div>
            </div>
          )}

          {status === "success" && (
            <div className="mx-auto max-w-sm space-y-6 py-4 text-center">
              <div className="flex flex-col items-center space-y-3">
                <div className="flex size-16 animate-bounce items-center justify-center rounded-full border border-emerald-500/20 bg-emerald-500/10 text-emerald-500 shadow-inner">
                  <CheckCircle2Icon className="size-10" />
                </div>
                <DialogTitle className="text-2xl font-bold tracking-tight text-ink">
                  {isDe ? "Rollover erfolgreich!" : "Rollover Completed!"}
                </DialogTitle>
                <DialogDescription className="text-sm leading-relaxed text-ink-secondary">
                  {isDe
                    ? `Die Nummerierungsreihen für das Geschäftsjahr ${targetYear} wurden erfolgreich erzeugt.`
                    : `The numbering sequences for the fiscal period ${targetYear} have been created successfully.`}
                </DialogDescription>
              </div>

              <div className="rounded-2xl border border-hairline/60 bg-canvas p-4 text-left font-mono text-xs">
                <div className="flex justify-between py-2">
                  <span className="text-ink-mute">{isDe ? "Firma:" : "Company:"}</span>
                  <span className="max-w-[180px] truncate font-bold text-ink">{companyName}</span>
                </div>
                <div className="flex justify-between py-2">
                  <span className="text-ink-mute">
                    {isDe ? "Neues Geschäftsjahr:" : "New Fiscal Year:"}
                  </span>
                  <span className="font-bold text-ink">{targetYear}</span>
                </div>
                <div className="flex justify-between py-2">
                  <span className="text-ink-mute">
                    {isDe ? "Belegkreise zurückgesetzt:" : "Document Series Reset:"}
                  </span>
                  <span className="font-mono font-bold text-emerald-600">
                    RE-, AN-, LI-, AU-, GU-
                  </span>
                </div>
              </div>

              <div className="pt-2">
                <Button
                  onClick={() => {
                    handleClose();
                    onCompleted();
                  }}
                  className="h-11 w-full gap-2 rounded-full bg-primary text-sm font-bold text-primary-foreground shadow-lg shadow-primary/25 hover:bg-primary/90"
                >
                  <SparklesIcon className="size-4" />
                  {isDe ? "Schließen" : "Close"}
                </Button>
              </div>
            </div>
          )}

          {status === "error" && (
            <div className="mx-auto max-w-sm space-y-6 py-4 text-center">
              <div className="flex flex-col items-center space-y-3">
                <div className="flex size-16 items-center justify-center rounded-full border border-destructive/20 bg-destructive/10 text-destructive shadow-inner">
                  <AlertTriangleIcon className="size-10" />
                </div>
                <DialogTitle className="text-2xl font-bold tracking-tight text-ink">
                  {isDe ? "Jahreswechsel fehlgeschlagen" : "Rollover Failed"}
                </DialogTitle>
                <DialogDescription className="text-sm leading-relaxed text-ink-secondary">
                  {isDe
                    ? "Es gab ein Problem beim Anlegen der neuen Nummernkreise."
                    : "There was a problem generating the new number sequences."}
                </DialogDescription>
              </div>

              <div className="max-h-[140px] overflow-y-auto rounded-2xl border border-destructive/25 bg-destructive/[0.03] p-4 text-left font-mono text-xs whitespace-pre-wrap text-destructive shadow-inner">
                {errorMessage}
              </div>

              <div className="flex gap-3 pt-2">
                <Button
                  variant="outline"
                  onClick={() => setStatus("idle")}
                  className="h-11 flex-1 gap-2 rounded-full border-hairline/80 text-sm font-semibold hover:bg-canvas-soft"
                >
                  <Undo2Icon className="size-4" />
                  {isDe ? "Zurück" : "Go Back"}
                </Button>
                <Button
                  onClick={() => void handleRollover()}
                  className="h-11 flex-1 rounded-full bg-primary text-sm font-semibold text-primary-foreground hover:bg-primary/90"
                >
                  {isDe ? "Erneut versuchen" : "Retry Rollover"}
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
