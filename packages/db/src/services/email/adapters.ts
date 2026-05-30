import { GmailProviderAdapter } from "./gmail-provider-adapter";
import { GraphProviderAdapter } from "./graph-provider-adapter";
import type { EmailProviderAdapter } from "./provider-adapter";
import type { EmailProvider } from "./types";

export function createEmailProviderAdapter(provider: EmailProvider): EmailProviderAdapter {
  switch (provider) {
    case "gmail":
      return new GmailProviderAdapter();
    case "microsoft":
      return new GraphProviderAdapter();
  }
}
