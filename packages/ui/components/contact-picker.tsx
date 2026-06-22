"use client";

import { XIcon, MailIcon, UserIcon } from "lucide-react";
import React, { useState, useRef, useEffect } from "react";

import { cn } from "../lib/utils";
import { Command, CommandEmpty, CommandGroup, CommandItem, CommandList } from "./command-palette";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";

export interface ContactRecord {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  type?: "contact" | "address";
}

export interface ContactPickerProps {
  label: string;
  value: ContactRecord[];
  onChange: (contacts: ContactRecord[]) => void;
  onSearch: (query: string) => Promise<ContactRecord[]>;
  placeholder?: string;
  className?: string;
}

export function ContactPicker({
  label,
  value,
  onChange,
  onSearch,
  placeholder = "Suchen oder E-Mail eingeben...",
  className,
}: ContactPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ContactRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!query) return;
    // Simulate debounce
    const timer = setTimeout(async () => {
      setIsLoading(true);
      try {
        const data = await onSearch(query);
        setResults(data);
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query, onSearch]);

  const handleSelect = (contact: ContactRecord) => {
    if (!value.find((c) => c.id === contact.id || c.email === contact.email)) {
      onChange([...value, contact]);
    }
    setQuery("");
    setOpen(false);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && query && !open) {
      e.preventDefault();
      // If valid email, just add it directly
      if (query.includes("@")) {
        handleSelect({ id: query, name: query, email: query });
      }
    } else if (e.key === "Backspace" && !query && value.length > 0) {
      // Remove last badge on backspace if input is empty
      onChange(value.slice(0, -1));
    }
  };

  const removeContact = (id: string) => {
    onChange(value.filter((c) => c.id !== id && c.email !== id));
  };

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-1.5 border-b border-border bg-background px-3 py-2 transition-colors focus-within:bg-muted/10",
        className,
      )}
      role="group"
      onClick={() => inputRef.current?.focus()}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          inputRef.current?.focus();
        }
      }}
    >
      <span className="w-12 shrink-0 text-sm font-medium text-muted-foreground">{label}:</span>

      {value.map((contact) => (
        <span
          key={contact.id}
          className="inline-flex items-center gap-1 rounded-md border border-primary/20 bg-primary/10 px-2 py-0.5 text-sm text-primary transition-colors hover:bg-primary/20"
        >
          {contact.name !== contact.email ? (
            <span className="font-medium">{contact.name}</span>
          ) : null}
          <span className={contact.name !== contact.email ? "text-xs opacity-70" : "font-medium"}>
            {contact.name !== contact.email ? `<${contact.email}>` : contact.email}
          </span>
          <button
            type="button"
            className="ml-0.5 rounded-full p-0.5 text-primary/70 hover:text-primary"
            onClick={(e) => {
              e.stopPropagation();
              removeContact(contact.id || contact.email);
            }}
          >
            <XIcon size={12} />
          </button>
        </span>
      ))}

      <div className="relative min-w-[200px] flex-1">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <input
              ref={inputRef}
              type="text"
              className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              placeholder={value.length === 0 ? placeholder : ""}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setOpen(true);
              }}
              onKeyDown={handleKeyDown}
              onFocus={() => {
                if (query) setOpen(true);
              }}
            />
          </PopoverTrigger>
          <PopoverContent
            className="w-[300px] p-0"
            align="start"
            onOpenAutoFocus={(e: { preventDefault: () => void }) => e.preventDefault()}
          >
            <Command>
              <CommandList>
                <CommandEmpty className="px-4 py-2 text-sm text-muted-foreground">
                  {isLoading
                    ? "Suche..."
                    : query.includes("@")
                      ? "Drücke Enter, um E-Mail hinzuzufügen."
                      : "Keine Kontakte gefunden."}
                </CommandEmpty>
                <CommandGroup>
                  {results.map((contact) => (
                    <CommandItem
                      key={contact.id}
                      value={`${contact.name} ${contact.email}`}
                      onSelect={() => handleSelect(contact)}
                      className="flex cursor-pointer items-center gap-2"
                    >
                      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-muted">
                        {contact.type === "contact" ? (
                          <UserIcon size={12} />
                        ) : (
                          <MailIcon size={12} />
                        )}
                      </div>
                      <div className="flex flex-col">
                        <span className="text-sm font-medium">{contact.name}</span>
                        <span className="text-xs text-muted-foreground">{contact.email}</span>
                      </div>
                    </CommandItem>
                  ))}
                  {query.includes("@") && !results.find((r) => r.email === query) && (
                    <CommandItem
                      onSelect={() => handleSelect({ id: query, name: query, email: query })}
                      className="flex cursor-pointer items-center gap-2 text-primary"
                    >
                      <MailIcon size={14} />
                      <span className="text-sm">"{query}" als E-Mail hinzufügen</span>
                    </CommandItem>
                  )}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}
