import { DataGrid } from "@repo/ui/components/data-grid";
import { EntityMask, type FieldDef } from "@repo/ui/components/entity-mask";
import { useActionBar } from "@repo/ui/platform/action-bar-context";
import { useCommands } from "@repo/ui/platform/command-registry";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";

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
  { key: "documentType", label: "Document Type", type: "text" },
  { key: "companyId", label: "Company", type: "text" },
  { key: "language", label: "Language", type: "text" },
  { key: "emailIdentityId", label: "Identity", type: "text" },
  { key: "priority", label: "Priority", type: "number" },
];

function EmailTemplatesRoute() {
  const queryClient = useQueryClient();
  const { setSubCrumb } = useActionBar();
  const { registerCommand } = useCommands();
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [selectedBindingId, setSelectedBindingId] = useState<string | null>(null);

  useEffect(() => {
    setSubCrumb("Email Templates");
    return () => setSubCrumb(undefined);
  }, [setSubCrumb]);

  const { data: templates = EMPTY } = useQuery<EmailTemplateRow[]>({
    queryKey: ["email-templates", "templates"],
    queryFn: async () => {
      const res = await fetch("/api/data/emailTemplate?limit=200&orderBy=updatedAt:desc");
      if (!res.ok) return [];
      return res.json();
    },
    placeholderData: keepPreviousData,
  });

  const { data: bindings = EMPTY } = useQuery<EmailTemplateBindingRow[]>({
    queryKey: ["email-templates", "bindings", selectedTemplateId],
    queryFn: async () => {
      if (!selectedTemplateId) return [];
      const params = new URLSearchParams({ emailTemplateId: selectedTemplateId, limit: "200" });
      const res = await fetch(`/api/data/emailTemplateBinding?${params.toString()}`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: Boolean(selectedTemplateId),
    placeholderData: keepPreviousData,
  });

  const selectedTemplate =
    templates.find((template) => template.emailTemplateId === selectedTemplateId) ?? null;
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
