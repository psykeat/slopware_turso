import { useQuery } from "@tanstack/react-query";
import { Edit2Icon, SearchIcon, XIcon } from "lucide-react";
import React, { useEffect, useRef, useState } from "react";

import { cn } from "../lib/utils";
import type { AddressSnapshot } from "./address-picker-field";

interface DeliveryAddressResult {
  deliveryAddressId: string;
  addressNo: string;
  name: string | null;
  companyName: string | null;
  addressLine1: string;
  postalCode: string;
  city: string;
  countryCode: string;
}

export interface DeliveryAddressPickerFieldProps {
  label: string;
  value: string | null;
  addressId: string | null;
  addressData: AddressSnapshot | null;
  onChange: (id: string | null, json: AddressSnapshot | null, raw?: DeliveryAddressResult) => void;
  tabIndex?: number;
  className?: string;
  locked?: boolean;
  lockLabel?: string;
  unlockLabel?: string;
  onToggleLock?: () => void;
}

const inputBase =
  "h-8 w-full border bg-canvas rounded px-2.5 text-[13px] text-ink outline-none transition-colors border-hairline-input focus-visible:ring-[3px] focus-visible:ring-[color-mix(in_oklab,var(--primary)_20%,transparent)] focus-visible:border-primary";

function displayName(snap: AddressSnapshot | null): string {
  if (!snap) return "";
  return (
    snap.name ||
    snap.companyName ||
    snap.company ||
    `${snap.firstName ?? snap.firstname ?? ""} ${snap.lastName ?? snap.lastname ?? ""}`.trim()
  );
}

function toSnapshot(addr: DeliveryAddressResult): AddressSnapshot {
  return {
    name: addr.name ?? addr.companyName ?? addr.addressNo,
    companyName: addr.companyName ?? undefined,
    company: addr.companyName ?? undefined,
    addressLine1: addr.addressLine1,
    street: addr.addressLine1,
    postalCode: addr.postalCode,
    zipcode: addr.postalCode,
    city: addr.city,
    town: addr.city,
    countryCode: addr.countryCode,
    country: addr.countryCode,
  };
}

export function DeliveryAddressPickerField({
  label,
  value,
  addressId,
  addressData,
  onChange,
  tabIndex,
  className,
  locked = false,
  lockLabel = "Lock",
  unlockLabel = "Unlock",
  onToggleLock,
}: DeliveryAddressPickerFieldProps) {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [localSnap, setLocalSnap] = useState<AddressSnapshot>(addressData ?? {});
  const prevValueRef = useRef(value);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { data: selectedDeliveryAddress } = useQuery<DeliveryAddressResult | null>({
    queryKey: ["delivery-address", value],
    queryFn: async () => {
      if (!value) return null;
      const res = await fetch(`/api/delivery-addresses/${value}`);
      if (!res.ok) return null;
      return res.json();
    },
    enabled: Boolean(value) && !addressData,
  });

  const { data: results = [] } = useQuery<DeliveryAddressResult[]>({
    queryKey: ["delivery-address-search", addressId, query],
    queryFn: async () => {
      if (!addressId) return [];
      const params = new URLSearchParams({
        q: query,
        limit: "20",
        addressId,
      });
      const res = await fetch(`/api/delivery-addresses/search?${params.toString()}`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: isOpen && query.length >= 1 && !!addressId,
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

  useEffect(() => {
    if (locked) {
      queueMicrotask(() => {
        setIsOpen(false);
        setQuery("");
        setSelectedIndex(0);
        setIsEditing(false);
      });
    }
  }, [locked]);

  useEffect(() => {
    const valueChanged = prevValueRef.current !== value;
    prevValueRef.current = value;
    if (isEditing && !valueChanged) return;
    if (valueChanged) setIsEditing(false);
    setLocalSnap(
      addressData ?? (selectedDeliveryAddress ? toSnapshot(selectedDeliveryAddress) : {}),
    );
  }, [addressData, isEditing, selectedDeliveryAddress, value]);

  const resolvedSnap =
    addressData ?? (selectedDeliveryAddress ? toSnapshot(selectedDeliveryAddress) : localSnap);

  const handleSelect = (addr: DeliveryAddressResult) => {
    if (locked) return;
    const snap = toSnapshot(addr);
    setLocalSnap(snap);
    onChange(addr.deliveryAddressId, snap, addr);
    setIsOpen(false);
    setQuery("");
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (locked) return;
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
    if (locked) return;
    const updated = { ...localSnap, [field]: val };
    if (field === "name") updated.companyName = val;
    setLocalSnap(updated);
    onChange(value, updated);
  };

  const handleClear = () => {
    if (locked) return;
    setLocalSnap({});
    onChange(null, null);
    setQuery("");
    inputRef.current?.focus();
  };

  const hasData = displayName(resolvedSnap).length > 0 || resolvedSnap.addressLine1;

  return (
    <div className={cn("flex flex-col gap-1.5", className)} ref={containerRef}>
      <div className="flex items-center justify-between gap-2">
        <label className="text-[11px] font-medium tracking-wider text-ink-mute uppercase">
          {label}
        </label>
        {onToggleLock ? (
          <button
            type="button"
            className={cn(
              "h-6 rounded-full border px-2 text-[10px] font-medium tracking-wider uppercase transition-colors",
              locked
                ? "border-primary/30 bg-[color-mix(in_oklab,var(--primary)_8%,var(--canvas))] text-primary"
                : "border-hairline text-ink-secondary hover:text-ink",
            )}
            onClick={onToggleLock}
            aria-pressed={locked}
            title={locked ? unlockLabel : lockLabel}
          >
            {locked ? unlockLabel : lockLabel}
          </button>
        ) : null}
      </div>

      <div className="relative">
        <input
          ref={inputRef}
          tabIndex={locked ? -1 : tabIndex}
          className={cn(inputBase, "pr-8", locked && "cursor-not-allowed opacity-80")}
          placeholder={addressId ? "Suchen..." : "Bitte zuerst Adresse wählen"}
          value={isOpen ? query : displayName(resolvedSnap)}
          readOnly={locked}
          aria-disabled={locked}
          onFocus={() => {
            if (locked) return;
            setIsOpen(true);
            setQuery("");
            setSelectedIndex(0);
          }}
          onChange={(e) => {
            if (locked) return;
            setQuery(e.target.value);
            setIsOpen(true);
            setSelectedIndex(0);
          }}
          onKeyDown={handleKeyDown}
        />
        {value && !locked ? (
          <button
            tabIndex={-1}
            className="absolute top-2 right-2 text-ink-mute transition-colors hover:text-ink"
            onClick={handleClear}
          >
            <XIcon className="size-3.5" />
          </button>
        ) : (
          <SearchIcon className="pointer-events-none absolute top-2 right-2.5 size-3.5 text-ink-mute" />
        )}

        {isOpen && results.length > 0 && (
          <div
            className="absolute z-50 mt-1 w-full overflow-auto rounded-md border border-hairline bg-canvas shadow-lg"
            style={{ maxHeight: 260 }}
          >
            {results.map((r, idx) => (
              <button
                key={r.deliveryAddressId}
                type="button"
                className={cn(
                  "flex w-full cursor-pointer flex-col border-b border-hairline px-3 py-2 text-left transition-colors last:border-0 hover:bg-canvas-soft",
                  idx === selectedIndex && "bg-canvas-soft",
                )}
                onMouseEnter={() => setSelectedIndex(idx)}
                onClick={() => handleSelect(r)}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-[13px] font-medium text-ink">
                    {r.name || r.companyName || r.addressNo}
                  </span>
                  <span className="shrink-0 font-mono text-[11px] text-primary">{r.addressNo}</span>
                </div>
                <span className="truncate text-[12px] text-ink-mute">{r.addressLine1}</span>
                <span className="text-[11px] text-ink-mute">
                  {r.postalCode} {r.city} · {r.countryCode}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="group relative">
        {isEditing ? (
          <div
            className={cn(
              "min-h-[56px] w-full rounded border px-3 py-2 text-left text-[12px] transition-colors",
              "border-hairline-input bg-canvas",
            )}
          >
            <div className="flex flex-col gap-2">
              <div className="mb-0.5 flex items-center justify-between">
                <span className="text-[10px] font-medium tracking-wider text-primary uppercase">
                  Manuelle Bearbeitung
                </span>
                <button
                  type="button"
                  tabIndex={-1}
                  className="text-ink-mute transition-colors hover:text-ink"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsEditing(false);
                  }}
                >
                  <XIcon className="size-3" />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                <input
                  className={cn(inputBase, "col-span-2 h-7 text-[12px]")}
                  placeholder="Name"
                  value={localSnap.name ?? ""}
                  readOnly={locked}
                  aria-disabled={locked}
                  onChange={(e) => handleLocalFieldChange("name", e.target.value)}
                />
                <input
                  className={cn(inputBase, "col-span-2 h-7 text-[12px]")}
                  placeholder="Strasse"
                  value={localSnap.addressLine1 ?? ""}
                  readOnly={locked}
                  aria-disabled={locked}
                  onChange={(e) => handleLocalFieldChange("addressLine1", e.target.value)}
                />
                <input
                  className={cn(inputBase, "h-7 text-[12px]")}
                  placeholder="PLZ"
                  value={localSnap.postalCode ?? ""}
                  readOnly={locked}
                  aria-disabled={locked}
                  onChange={(e) => handleLocalFieldChange("postalCode", e.target.value)}
                />
                <input
                  className={cn(inputBase, "h-7 text-[12px]")}
                  placeholder="Ort"
                  value={localSnap.city ?? ""}
                  readOnly={locked}
                  aria-disabled={locked}
                  onChange={(e) => handleLocalFieldChange("city", e.target.value)}
                />
              </div>
            </div>
          </div>
        ) : (
          <button
            type="button"
            className={cn(
              "min-h-[56px] w-full rounded border px-3 py-2 text-left text-[12px] transition-colors",
              locked
                ? "cursor-not-allowed border-hairline bg-canvas-soft opacity-70"
                : "cursor-pointer border-hairline bg-canvas-soft hover:border-hairline-input",
            )}
            tabIndex={locked ? -1 : 0}
            onClick={() => {
              if (locked) return;
              setLocalSnap(resolvedSnap);
              setIsEditing(true);
            }}
          >
            {hasData ? (
              <>
                <div className="font-medium text-ink">{displayName(resolvedSnap)}</div>
                {resolvedSnap.addressLine1 && (
                  <div className="text-ink-mute">{resolvedSnap.addressLine1}</div>
                )}
                {(resolvedSnap.postalCode || resolvedSnap.city) && (
                  <div className="text-ink-mute">
                    {resolvedSnap.postalCode} {resolvedSnap.city}
                    {resolvedSnap.countryCode && ` · ${resolvedSnap.countryCode}`}
                  </div>
                )}
                <div className="absolute top-2 right-2 opacity-0 transition-opacity group-hover:opacity-100">
                  <Edit2Icon className="size-3 text-ink-mute" />
                </div>
              </>
            ) : (
              <span className="text-ink-mute italic">Keine Lieferadresse ausgewählt</span>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
