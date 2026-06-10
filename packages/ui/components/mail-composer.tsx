"use client";

import { PaperclipIcon, ChevronDownIcon, XIcon } from "lucide-react";
import React, { useState } from "react";

import { cn } from "../lib/utils";
import { Button } from "./button";
import { ContactPicker, ContactRecord } from "./contact-picker";
import { RichTextEditor } from "./rich-text-editor";

export interface MailComposerProps {
  className?: string;
  onSend?: (payload: {
    to: ContactRecord[];
    cc: ContactRecord[];
    bcc: ContactRecord[];
    subject: string;
    body: string;
    mode: "plain" | "html";
  }) => void;
  onCancel?: () => void;
  searchContacts: (query: string) => Promise<ContactRecord[]>;
}

export function MailComposer({ className, onSend, onCancel, searchContacts }: MailComposerProps) {
  const [to, setTo] = useState<ContactRecord[]>([]);
  const [cc, setCc] = useState<ContactRecord[]>([]);
  const [bcc, setBcc] = useState<ContactRecord[]>([]);
  const [showCc, setShowCc] = useState(false);
  const [showBcc, setShowBcc] = useState(false);

  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [mode, setMode] = useState<"plain" | "html">("html");

  const handleSend = () => {
    onSend?.({ to, cc, bcc, subject, body, mode });
  };

  return (
    <div
      className={cn(
        "flex flex-col overflow-hidden rounded-lg border border-border bg-background shadow-sm",
        className,
      )}
    >
      <div className="flex items-center justify-between border-b border-border bg-muted/20 px-4 py-2">
        <h3 className="text-sm font-medium">Neue Nachricht</h3>
        <div className="flex items-center gap-2">
          {onCancel && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground"
              onClick={onCancel}
            >
              <XIcon size={14} />
            </Button>
          )}
        </div>
      </div>

      <div className="flex flex-col">
        <div className="relative flex items-center">
          <ContactPicker
            className="flex-1 border-r border-b-0"
            label="An"
            value={to}
            onChange={setTo}
            onSearch={searchContacts}
          />
          <div className="flex items-center gap-2 px-3 text-xs font-medium text-muted-foreground">
            {!showCc && (
              <button
                onClick={() => setShowCc(true)}
                className="transition-colors hover:text-foreground"
              >
                Cc
              </button>
            )}
            {!showBcc && (
              <button
                onClick={() => setShowBcc(true)}
                className="transition-colors hover:text-foreground"
              >
                Bcc
              </button>
            )}
          </div>
        </div>

        {showCc && (
          <ContactPicker label="Cc" value={cc} onChange={setCc} onSearch={searchContacts} />
        )}

        {showBcc && (
          <ContactPicker label="Bcc" value={bcc} onChange={setBcc} onSearch={searchContacts} />
        )}

        <div className="flex items-center border-b border-border px-3 py-2 transition-colors focus-within:bg-muted/10">
          <input
            type="text"
            className="w-full bg-transparent text-sm font-medium outline-none placeholder:font-normal placeholder:text-muted-foreground"
            placeholder="Betreff"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
          />
        </div>
      </div>

      <div className="flex flex-1 flex-col bg-background p-2">
        <RichTextEditor
          className="flex-1 border-none shadow-none focus-within:ring-0"
          mode={mode}
          onChange={(val, newMode) => {
            setBody(val);
            setMode(newMode);
          }}
        />
      </div>

      <div className="flex items-center justify-between border-t bg-muted/20 p-3">
        <div className="flex items-center gap-2">
          <div className="flex items-center">
            <Button
              size="sm"
              className="rounded-r-none pr-3"
              onClick={handleSend}
              disabled={to.length === 0}
            >
              Senden
            </Button>
            <Button
              size="sm"
              variant="default"
              className="rounded-l-none border-l border-primary-foreground/20 px-2"
            >
              <ChevronDownIcon size={14} />
            </Button>
          </div>

          <Button variant="ghost" size="icon" className="ml-2 text-muted-foreground">
            <PaperclipIcon size={16} />
          </Button>
        </div>

        <div>
          {/* <Button variant="ghost" size="sm" className="text-destructive">Löschen</Button> */}
        </div>
      </div>
    </div>
  );
}
