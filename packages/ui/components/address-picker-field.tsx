import React, { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Edit2Icon, SearchIcon, XIcon } from "lucide-react";
import { cn } from "../lib/utils";

interface AddressResult {
  addressId: string;
  addressNo: string;
  companyName: string | null;
  firstName: string | null;
  lastName: string | null;
  addressLine1: string;
  postalCode: string;
  city: string;
  countryCode: string;
  currencyId?: string | null;
  paymentTermId?: string | null;
  defaultDeliveryAddressId?: string | null;
}

export interface AddressSnapshot {
  name?: string;
  companyName?: string;
  firstName?: string;
  lastName?: string;
  addressLine1?: string;
  postalCode?: string;
  city?: string;
  countryCode?: string;
}

export interface AddressPickerFieldProps {
  label: string;
  value: string | null;
  addressData: AddressSnapshot | null;
  onChange: (id: string | null, json: AddressSnapshot | null, raw?: AddressResult) => void;
  tabIndex?: number;
  className?: string;
}

const inputBase =
  "h-8 w-full border bg-canvas rounded px-2.5 text-[13px] text-ink outline-none transition-colors border-hairline-input focus-visible:ring-[3px] focus-visible:ring-[color-mix(in_oklab,var(--primary)_20%,transparent)] focus-visible:border-primary";

function displayName(snap: AddressSnapshot | null): string {
  if (!snap) return "";
  return snap.companyName || snap.name || `${snap.firstName ?? ""} ${snap.lastName ?? ""}`.trim();
}

export function AddressPickerField({
  label,
  value,
  addressData,
  onChange,
  tabIndex,
  className,
}: AddressPickerFieldProps) {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [localSnap, setLocalSnap] = useState<AddressSnapshot>(addressData ?? {});

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setLocalSnap(addressData ?? {});
  }, [addressData]);

  const { data: results = [] } = useQuery<AddressResult[]>({
    queryKey: ["address-search", query],
    queryFn: async () => {
      const res = await fetch(`/api/addresses/search?q=${encodeURIComponent(query)}&limit=20`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: isOpen && query.length >= 1,
  });

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleSelect = (addr: AddressResult) => {
    const snap: AddressSnapshot = {
      name: addr.companyName || `${addr.firstName ?? ""} ${addr.lastName ?? ""}`.trim(),
      companyName: addr.companyName ?? undefined,
      firstName: addr.firstName ?? undefined,
      lastName: addr.lastName ?? undefined,
      addressLine1: addr.addressLine1,
      postalCode: addr.postalCode,
      city: addr.city,
      countryCode: addr.countryCode,
    };
    setLocalSnap(snap);
    onChange(addr.addressId, snap, addr);
    setIsOpen(false);
    setQuery("");
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && isOpen && results[selectedIndex]) {
      e.preventDefault();
      handleSelect(results[selectedIndex]);
    } else if (e.key === "Escape") {
      setIsOpen(false);
    }
  };

  const handleLocalFieldChange = (field: keyof AddressSnapshot, val: string) => {
    const updated = { ...localSnap, [field]: val };
    if (field === "companyName") updated.name = val;
    setLocalSnap(updated);
    onChange(value, updated);
  };

  const handleClear = () => {
    setLocalSnap({});
    onChange(null, null);
    setQuery("");
    inputRef.current?.focus();
  };

  const hasData = displayName(localSnap).length > 0 || localSnap.addressLine1;

  return (
    <div className={cn("flex flex-col gap-1.5", className)} ref={containerRef}>
      <label className="text-[11px] font-medium uppercase tracking-wider text-ink-mute">
        {label}
      </label>

      <div className="relative">
        <input
          ref={inputRef}
          tabIndex={tabIndex}
          className={cn(inputBase, "pr-8")}
          placeholder="Suchen..."
          value={isOpen ? query : displayName(localSnap)}
          onFocus={() => {
            setIsOpen(true);
            setQuery("");
            setSelectedIndex(0);
          }}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
            setSelectedIndex(0);
          }}
          onKeyDown={handleKeyDown}
        />
        {value ? (
          <button
            tabIndex={-1}
            className="absolute top-2 right-2 text-ink-mute hover:text-ink transition-colors"
            onClick={handleClear}
          >
            <XIcon className="size-3.5" />
          </button>
        ) : (
          <SearchIcon className="pointer-events-none absolute top-2 right-2.5 size-3.5 text-ink-mute" />
        )}

        {isOpen && results.length > 0 && (
          <div className="absolute z-50 mt-1 w-full overflow-auto rounded-md border border-hairline bg-canvas shadow-lg" style={{ maxHeight: 260 }}>
            {results.map((r, idx) => (
              <div
                key={r.addressId}
                className={cn(
                  "flex cursor-pointer flex-col border-b border-hairline px-3 py-2 last:border-0 hover:bg-canvas-soft transition-colors",
                  idx === selectedIndex && "bg-canvas-soft",
                )}
                onMouseEnter={() => setSelectedIndex(idx)}
                onClick={() => handleSelect(r)}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-[13px] font-medium text-ink">
                    {r.companyName || `${r.firstName ?? ""} ${r.lastName ?? ""}`.trim()}
                  </span>
                  <span className="shrink-0 font-mono text-[11px] text-primary">
                    {r.addressNo}
                  </span>
                </div>
                <span className="text-[12px] text-ink-mute truncate">{r.addressLine1}</span>
                <span className="text-[11px] text-ink-mute">
                  {r.postalCode} {r.city} · {r.countryCode}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Address card */}
      <div className="group relative">
        <div
          className={cn(
            "rounded border px-3 py-2 text-[12px] transition-colors min-h-[56px]",
            isEditing
              ? "border-hairline-input bg-canvas"
              : "border-hairline bg-canvas-soft cursor-pointer hover:border-hairline-input",
          )}
          onClick={() => !isEditing && setIsEditing(true)}
        >
          {isEditing ? (
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between mb-0.5">
                <span className="text-[10px] font-medium uppercase tracking-wider text-primary">
                  Manuelle Bearbeitung
                </span>
                <button
                  tabIndex={-1}
                  className="text-ink-mute hover:text-ink transition-colors"
                  onClick={(e) => { e.stopPropagation(); setIsEditing(false); }}
                >
                  <XIcon className="size-3" />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                <input
                  className={cn(inputBase, "col-span-2 h-7 text-[12px]")}
                  placeholder="Firma / Name"
                  value={localSnap.companyName ?? ""}
                  onChange={(e) => handleLocalFieldChange("companyName", e.target.value)}
                />
                <input
                  className={cn(inputBase, "col-span-2 h-7 text-[12px]")}
                  placeholder="Strasse"
                  value={localSnap.addressLine1 ?? ""}
                  onChange={(e) => handleLocalFieldChange("addressLine1", e.target.value)}
                />
                <input
                  className={cn(inputBase, "h-7 text-[12px]")}
                  placeholder="PLZ"
                  value={localSnap.postalCode ?? ""}
                  onChange={(e) => handleLocalFieldChange("postalCode", e.target.value)}
                />
                <input
                  className={cn(inputBase, "h-7 text-[12px]")}
                  placeholder="Ort"
                  value={localSnap.city ?? ""}
                  onChange={(e) => handleLocalFieldChange("city", e.target.value)}
                />
              </div>
            </div>
          ) : hasData ? (
            <>
              <div className="font-medium text-ink">{displayName(localSnap)}</div>
              {localSnap.addressLine1 && <div className="text-ink-mute">{localSnap.addressLine1}</div>}
              {(localSnap.postalCode || localSnap.city) && (
                <div className="text-ink-mute">
                  {localSnap.postalCode} {localSnap.city}
                  {localSnap.countryCode && ` · ${localSnap.countryCode}`}
                </div>
              )}
              <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <Edit2Icon className="size-3 text-ink-mute" />
              </div>
            </>
          ) : (
            <span className="text-ink-mute italic">Keine Adresse ausgewählt</span>
          )}
        </div>
      </div>
    </div>
  );
}
