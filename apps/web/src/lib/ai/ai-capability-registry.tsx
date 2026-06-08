import React from "react";

import { MailClassificationReview } from "../../components/ai/reviews/MailClassificationReview";
import { MailOrderReview } from "../../components/ai/reviews/MailOrderReview";
import { MailToDocumentDraftReview } from "../../components/ai/reviews/MailToDocumentDraftReview";

interface AiTaskDefinition<TPayload = any, TValidation = any> {
  taskScope: string;
  label: { en: string; de: string };
  icon: string;
  renderReview: (props: {
    suggestionPayload: TPayload;
    validation: TValidation;
    onPatch: (patch: Partial<TPayload>) => void;
    onRequestLookup?: (fieldKey: string, query: string) => Promise<any[]>;
  }) => React.ReactNode;
}

class ClientAiCapabilityRegistry {
  private tasks = new Map<string, AiTaskDefinition>();

  register(task: AiTaskDefinition) {
    this.tasks.set(task.taskScope, task);
  }

  get(taskScope: string): AiTaskDefinition | undefined {
    return this.tasks.get(taskScope);
  }

  getAll(): AiTaskDefinition[] {
    return Array.from(this.tasks.values());
  }
}

export const aiCapabilityRegistry = new ClientAiCapabilityRegistry();

// Bootstrapped registration of mail tasks
aiCapabilityRegistry.register({
  taskScope: "mail-classification",
  label: { en: "Classify & Link E-Mail", de: "E-Mail klassifizieren & zuordnen" },
  icon: "Tag",
  renderReview: (props) => <MailClassificationReview {...props} />,
});

aiCapabilityRegistry.register({
  taskScope: "mail-to-document-draft",
  label: { en: "Draft ERP Document Proposal", de: "Belegentwurf vorschlagen" },
  icon: "FileText",
  renderReview: (props) => <MailToDocumentDraftReview {...props} />,
});

aiCapabilityRegistry.register({
  taskScope: "mail-order-review",
  label: { en: "Mail order review", de: "Mail-Bestellung prüfen" },
  icon: "Sparkles",
  renderReview: (props) => <MailOrderReview {...props} />,
});
