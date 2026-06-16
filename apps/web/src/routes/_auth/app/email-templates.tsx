import { DataGrid } from "@repo/ui/components/data-grid";
import { EntityMask, type FieldDef } from "@repo/ui/components/entity-mask";
import {
  DOCUMENT_TEMPLATE_VARIABLES,
  SAMPLE_TEMPLATE_DATA,
  renderTemplatePreview,
} from "@repo/ui/lib/template-preview";
import { useActionBar } from "@repo/ui/platform/action-bar-context";
import { useCommands } from "@repo/ui/platform/command-registry";
import { keepPreviousData, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";

import { useCapabilityQuery } from "#/queries/capability";

export const Route = createFileRoute("/_auth/app/email-templates")({
  component: EmailTemplatesRoute,
});

type EmailTemplateRow = {
  emailTemplateId: string;
  category: string;
  code: string;
  name: string;
  subjectTemplate: string;
  bodyHtmlTemplate: string;
  bodyTextTemplate: string | null;
  language: string | null;
  archived: boolean;
  createdAt: string;
  updatedAt: string | null;
};

type EmailTemplateBindingRow = {
  emailTemplateBindingId: string;
  emailTemplateId: string;
  documentType: string | null;
  companyId: string | null;
  language: string | null;
  emailIdentityId: string | null;
  priority: number;
  archived: boolean;
  createdAt: string;
};

const EMPTY: never[] = [];

const EMPTY_CREATE_TEMPLATE_VALUES = {
  category: "document",
  code: "",
  name: "",
  subjectTemplate: "",
  bodyHtmlTemplate: "<p></p>",
  bodyTextTemplate: "",
  language: null,
} as const;

const TEMPLATE_FIELDS: FieldDef[] = [
  {
    key: "category",
    label: "Category",
    type: "text",
    required: true,
    helpText: "Business case, e.g. document.",
  },
  { key: "code", label: "Code", type: "text", required: true, helpText: "Stable template key." },
  { key: "name", label: "Name", type: "text", required: true, helpText: "Human-readable label." },
  {
    key: "subjectTemplate",
    label: "Subject Template",
    type: "textarea",
    required: true,
    fullWidth: true,
    helpText: "Supports {{path}} placeholders.",
  },
  {
    key: "bodyHtmlTemplate",
    label: "Body HTML Template",
    type: "textarea",
    required: true,
    fullWidth: true,
    helpText: "Rendered HTML body.",
  },
  {
    key: "bodyTextTemplate",
    label: "Body Text Template",
    type: "textarea",
    fullWidth: true,
    helpText: "Optional plain-text fallback.",
  },
  {
    key: "language",
    label: "Language",
    type: "text",
    helpText: "Optional 2-letter language code.",
  },
];

const TEMPLATE_BINDING_FIELDS: FieldDef[] = [
  { key: "emailTemplateId", label: "Template", type: "text", required: true, readonly: true },
  {
    key: "documentType",
    label: "Document Type",
    type: "text",
    helpText: "1-Zeichen-Belegart: N=Angebot, A=Auftrag, L=Lieferschein, R=Rechnung, G=Gutschrift.",
  },
  { key: "companyId", label: "Company", type: "text" },
  { key: "language", label: "Language", type: "text" },
  { key: "emailIdentityId", label: "Identity", type: "text" },
  { key: "priority", label: "Priority", type: "number" },
];

function TemplatePreviewPanel({ subject, bodyHtml }: { subject: string; bodyHtml: string }) {
  const renderedSubject = renderTemplatePreview(subject, SAMPLE_TEMPLATE_DATA);
  const renderedBody = renderTemplatePreview(bodyHtml, SAMPLE_TEMPLATE_DATA);
  return (
    <div className="mt-4 grid gap-4 md:grid-cols-2">
      <div className="rounded border border-hairline bg-canvas-soft p-3">
        <div className="mb-2 text-[12px] font-medium text-ink-secondary">
          Vorschau (Beispieldaten)
        </div>
        <div className="mb-1 text-[11px] text-ink-muted">Betreff</div>
        <div className="mb-3 rounded-sm bg-canvas px-2 py-1 text-[13px] text-ink">
          {renderedSubject || <span className="text-ink-muted">—</span>}
        </div>
        <div className="mb-1 text-[11px] text-ink-muted">Text</div>
        <div
          className="prose prose-sm max-w-none rounded-sm bg-canvas px-2 py-1 text-[13px] text-ink"
          // Preview only: rendered from the tenant's own template + sample data.
          dangerouslySetInnerHTML={{ __html: renderedBody }}
        />
      </div>
      <div className="rounded border border-hairline bg-canvas-soft p-3">
        <div className="mb-2 text-[12px] font-medium text-ink-secondary">
          Verfügbare Variablen
        </div>
        <ul className="flex flex-col gap-1">
          {DOCUMENT_TEMPLATE_VARIABLES.map((variable) => (
            <li key={variable.token} className="flex items-baseline gap-2 text-[12px]">
              <code className="rounded-sm bg-canvas px-1 py-0.5 text-[11px] text-primary">{`{{${variable.token}}}`}</code>
              <span className="text-ink-muted">{variable.description}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function EmailTemplatesRoute() {
  const queryClient = useQueryClient();
  const { setSubCrumb } = useActionBar();
  const { registerCommand } = useCommands();
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [selectedBindingId, setSelectedBindingId] = useState<string | null>(null);
  const [previewSubject, setPreviewSubject] = useState("");
  const [previewBodyHtml, setPreviewBodyHtml] = useState("");

  useEffect(() => {
    setSubCrumb("Email Templates");
    return () => setSubCrumb(undefined);
  }, [setSubCrumb]);

  const { data: templateData } = useCapabilityQuery(
    "communication.emailTemplate.list",
    { filters: {}, limit: 200, orderBy: "updatedAt:desc" },
    { placeholderData: keepPreviousData },
  );
  const templates = (templateData?.items ?? EMPTY) as EmailTemplateRow[];

  const { data: bindingData } = useCapabilityQuery(
    "communication.emailTemplateBinding.list",
    { filters: { emailTemplateId: selectedTemplateId! }, limit: 200 },
    { enabled: Boolean(selectedTemplateId), placeholderData: keepPreviousData },
  );
  const bindings = (bindingData?.items ?? EMPTY) as EmailTemplateBindingRow[];

  const selectedTemplate =
    templates.find((template) => template.emailTemplateId === selectedTemplateId) ?? null;

  // Seed the live preview from the loaded template (edit) or the create defaults
  // whenever the selection changes — adjusting state during render (React's
  // blessed alternative to a sync effect). onFieldChange keeps it in sync as the
  // user edits the subject/body fields.
  const [previewSeedId, setPreviewSeedId] = useState<string | null>(selectedTemplateId);
  if (previewSeedId !== selectedTemplateId) {
    setPreviewSeedId(selectedTemplateId);
    setPreviewSubject(
      selectedTemplate?.subjectTemplate ?? EMPTY_CREATE_TEMPLATE_VALUES.subjectTemplate,
    );
    setPreviewBodyHtml(
      selectedTemplate?.bodyHtmlTemplate ?? EMPTY_CREATE_TEMPLATE_VALUES.bodyHtmlTemplate,
    );
  }
  const createTemplateInitialValues = useMemo(
    () => (selectedTemplateId ? undefined : { ...EMPTY_CREATE_TEMPLATE_VALUES }),
    [selectedTemplateId],
  );
  const createBindingInitialValues = useMemo(
    () =>
      selectedBindingId
        ? undefined
        : {
            emailTemplateId: selectedTemplateId,
            priority: 100,
          },
    [selectedBindingId, selectedTemplateId],
  );

  useEffect(() => {
    const unregNewTemplate = registerCommand({
      id: "email-template-new",
      scope: "context",
      group: "email",
      label: { en: "New email template", de: "Neue E-Mail-Vorlage" },
      shortcut: "F3",
      handler: () => {
        setSelectedTemplateId(null);
        setSelectedBindingId(null);
      },
    });
    const unregNewBinding = registerCommand({
      id: "email-template-binding-new",
      scope: "context",
      group: "email",
      label: { en: "New template binding", de: "Neue Vorlagenbindung" },
      shortcut: "F4",
      isEnabled: () => Boolean(selectedTemplateId),
      handler: () => setSelectedBindingId(null),
    });
    return () => {
      unregNewTemplate();
      unregNewBinding();
    };
  }, [registerCommand, selectedTemplateId]);

  return (
    <div className="grid h-full min-h-0 grid-cols-[minmax(280px,34%)_1fr] bg-canvas">
      <section className="flex min-h-0 flex-col border-r border-hairline">
        <div className="flex h-10 items-center justify-between border-b border-hairline px-3">
          <div className="text-[13px] text-ink-secondary">Templates</div>
          <button
            type="button"
            onClick={() => {
              setSelectedTemplateId(null);
              setSelectedBindingId(null);
            }}
            className="rounded-sm border border-hairline px-2 py-1 text-[12px] text-ink-secondary hover:bg-canvas-soft hover:text-ink"
          >
            New
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-auto">
          <DataGrid
            entityName="emailTemplate"
            panelId="email-template-grid"
            data={templates}
            keyExtractor={(row) => row.emailTemplateId}
            columns={[
              { key: "category", header: "Category", sortable: true, width: "110px" },
              { key: "code", header: "Code", sortable: true, width: "140px" },
              { key: "name", header: "Name", sortable: true },
              { key: "language", header: "Lang", sortable: true, width: "70px" },
            ]}
            emptyTitle="No templates"
            emptySubtitle="Create a document template before preparing document mail."
            onRowClick={(row) => {
              setSelectedTemplateId(row.emailTemplateId);
              setSelectedBindingId(null);
            }}
          />
        </div>
      </section>
      <section className="min-h-0 overflow-auto p-4">
        <div className="mx-auto flex max-w-4xl flex-col gap-4">
          <EntityMask
            entityName="emailTemplate"
            recordId={selectedTemplateId ?? undefined}
            mode={selectedTemplateId ? "edit" : "create"}
            title={selectedTemplate ? `Edit ${selectedTemplate.code}` : "Create template"}
            fields={TEMPLATE_FIELDS}
            initialValues={createTemplateInitialValues}
            onFieldChange={(key, value) => {
              if (key === "subjectTemplate") setPreviewSubject(typeof value === "string" ? value : "");
              if (key === "bodyHtmlTemplate")
                setPreviewBodyHtml(typeof value === "string" ? value : "");
            }}
            postFieldsSection={
              <TemplatePreviewPanel subject={previewSubject} bodyHtml={previewBodyHtml} />
            }
            onSaved={(record) => {
              const next = record as EmailTemplateRow;
              setSelectedTemplateId(next.emailTemplateId);
              queryClient.invalidateQueries({ queryKey: ["email-templates"] });
            }}
          />
          {selectedTemplateId && (
            <>
              <EntityMask
                entityName="emailTemplateBinding"
                recordId={selectedBindingId ?? undefined}
                mode={selectedBindingId ? "edit" : "create"}
                title={selectedBindingId ? "Edit binding" : "Create binding"}
                fields={TEMPLATE_BINDING_FIELDS}
                initialValues={createBindingInitialValues}
                onSaved={(record) => {
                  const next = record as EmailTemplateBindingRow;
                  setSelectedBindingId(next.emailTemplateBindingId);
                  queryClient.invalidateQueries({ queryKey: ["email-templates"] });
                }}
              />
              <DataGrid
                entityName="emailTemplateBinding"
                panelId="email-template-binding-grid"
                data={bindings}
                keyExtractor={(row) => row.emailTemplateBindingId}
                columns={[
                  { key: "priority", header: "Priority", sortable: true, width: "90px" },
                  { key: "documentType", header: "Doc Type", sortable: true, width: "120px" },
                  { key: "companyId", header: "Company", sortable: false },
                  { key: "language", header: "Language", sortable: true, width: "90px" },
                  { key: "emailIdentityId", header: "Identity", sortable: false },
                ]}
                emptyTitle="No bindings"
                emptySubtitle="Add a binding to scope this template."
                onRowClick={(row) => setSelectedBindingId(row.emailTemplateBindingId)}
              />
            </>
          )}
        </div>
      </section>
    </div>
  );
}
