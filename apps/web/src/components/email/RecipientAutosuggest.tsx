import { useQuery } from "@tanstack/react-query";
import React, { useRef, useState } from "react";

import { capability } from "#/server-fns/capabilities";

import { formatRecipientAutocompleteContact, getRecipientTokenRange, replaceRecipientToken, type RecipientAutocompleteContact } from "./email-recipient-autocomplete";

export function RecipientAutosuggest({ value, onChange, placeholder, disabled }: { value: string; onChange: (val: string) => void; placeholder?: string; disabled?: boolean }) {
  const [isManuallyClosed, setIsManuallyClosed] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const [cursor, setCursor] = useState<{ start: number; end: number } | null>(null);

  const activeToken = cursor ? getRecipientTokenRange(value, cursor.start, cursor.end) : null;
  const searchQuery = activeToken?.query || "";

  const { data: contacts = [] } = useQuery({
    queryKey: ["email", "contacts", "lookup", searchQuery],
    queryFn: async () => {
      if (!searchQuery || searchQuery.length < 2) return [];
      const { items } = await capability("masterdata.addressContact.search")({
        q: searchQuery,
        limit: 10,
      });
      return items;
    },
    enabled: searchQuery.length >= 2,
  });

  const open = contacts.length > 0 && !!activeToken && searchQuery.length >= 2 && !isManuallyClosed;

  const handleSelect = (contact: RecipientAutocompleteContact) => {
    if (!activeToken) return;
    const replacement = formatRecipientAutocompleteContact(contact);
    const newValue = replaceRecipientToken(value, { start: activeToken.start, end: activeToken.end }, replacement);
    onChange(newValue);
    setIsManuallyClosed(true);
    setTimeout(() => {
      inputRef.current?.focus();
    }, 10);
  };

  return (
    <div className="relative w-full">
      <input
        ref={inputRef}
        className="border-0 bg-transparent shadow-none focus-visible:ring-0 w-full outline-none text-sm placeholder:text-muted-foreground"
        placeholder={placeholder}
          value={value}
          disabled={disabled}
          onChange={(e) => {
            onChange(e.target.value);
            setIsManuallyClosed(false);
            setCursor({ start: e.target.selectionStart || 0, end: e.target.selectionEnd || 0 });
          }}
          onKeyUp={(e) => {
            setIsManuallyClosed(false);
            setCursor({ start: e.currentTarget.selectionStart || 0, end: e.currentTarget.selectionEnd || 0 });
          }}
          onClick={(e) => {
            setIsManuallyClosed(false);
            setCursor({ start: e.currentTarget.selectionStart || 0, end: e.currentTarget.selectionEnd || 0 });
          }}
          autoComplete="off"
        />
      {open && (
        <div className="absolute top-full left-0 z-50 mt-1 w-[300px] rounded-md border bg-popover text-popover-foreground shadow-md outline-none">
          <div className="max-h-[200px] overflow-auto py-1">
            {contacts.map((contact: any) => (
              <button
                key={contact.contactId || contact.id || contact.email}
                className="w-full text-left px-3 py-1.5 text-sm hover:bg-muted focus:bg-muted outline-none"
                onClick={() => handleSelect(contact)}
                type="button"
              >
                <div className="font-medium">{contact.name || contact.firstName + ' ' + contact.lastName}</div>
                <div className="text-xs text-muted-foreground">{contact.email}</div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
