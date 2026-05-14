import React, { useState } from "react";
import { GlobeIcon } from "lucide-react";
import { Button } from "./button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./dropdown-menu";

export function LanguageSwitcher() {
  const [lang, setLang] = useState<"en" | "de">("en");

  const languages = [
    { code: "en", label: "English" },
    { code: "de", label: "Deutsch" },
  ];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="ghost" size="sm" className="h-8 px-2 gap-2 text-ink-mute hover:text-ink">
            <GlobeIcon className="size-4" />
            <span className="text-xs font-medium uppercase">{lang}</span>
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="w-32">
        {languages.map((l) => (
          <DropdownMenuItem
            key={l.code}
            className="text-xs cursor-pointer"
            onClick={() => setLang(l.code as any)}
          >
            {l.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
