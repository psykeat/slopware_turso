import { ContextTabs } from "@repo/ui/components/context-tabs";
import { CustomerStatsSection } from "@repo/ui/components/customer-stats-section";
import { DataGrid, type DataGridHandle } from "@repo/ui/components/data-grid";
import { Dialog, DialogContent } from "@repo/ui/components/dialog";
import { EntityMask } from "@repo/ui/components/entity-mask";
import { InlineEditGrid } from "@repo/ui/components/inline-edit-grid";
import { InspectorPanel } from "@repo/ui/components/inspector-panel";
import { LangTextRecordPanel } from "@repo/ui/components/langtext-record-panel";
import { NavigationTree, type TreeNode } from "@repo/ui/components/navigation-tree";
import { TriViewWorkspace } from "@repo/ui/components/triview-workspace";
import { formatMoney, formatDate, StatusDot } from "@repo/ui/lib/formatters";
import { useActionBar } from "@repo/ui/platform/action-bar-context";
import { useCommands } from "@repo/ui/platform/command-registry";
import { useFocus } from "@repo/ui/platform/focus-manager";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import React, { useEffect, useMemo, useState, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { useGridUrlState } from "#/hooks/use-grid-url-state";

export const Route = createFileRoute("/_auth/app/addresses")({
  component: AddressesModule,
});

const EMPTY_ARRAY: any[] = [];

const ADDRESS_TEXT_FIELD_OVERRIDES = [
  { key: "notiztext", visible: false },
  { key: "warntext", visible: false },
  { key: "langtext", visible: false },
];

const ADDRESS_FIELD_OVERRIDES_ALL = ADDRESS_TEXT_FIELD_OVERRIDES;

function ContactNotizEditor({
  contactLabel,
  contactId,
  initialValue,
  title,
  emptyLabel,
  placeholder,
  onChange,
  disabled,
}: {
  contactLabel: string;
  contactId: string | null;
  initialValue: string;
  title: string;
  emptyLabel: string;
  placeholder: string;
  onChange: (notiztext: string) => void;
  disabled: boolean;
}) {
  const [draft, setDraft] = useState(initialValue);
  const initialValueRef = useRef(initialValue);

  useEffect(() => {
    initialValueRef.current = initialValue;
  }, [initialValue]);

  useEffect(() => {
    if (!contactId) return;
    if (draft === initialValueRef.current) return;

    const timeout = window.setTimeout(() => {
      onChange(draft);
    }, 450);

    return () => window.clearTimeout(timeout);
  }, [contactId, draft, onChange]);

  return (
    <div className="flex min-h-[18rem] min-w-0 flex-col overflow-hidden rounded-xl border border-hairline bg-canvas shadow-sm">
      <div className="border-b border-hairline px-4 py-3">
        <div className="text-[11px] font-medium tracking-wider text-ink-mute uppercase">
          {title}
        </div>
        <div className="mt-0.5 truncate text-[12px] text-ink-secondary">
          {contactLabel || emptyLabel}
        </div>
      </div>
      <textarea
        value={contactId ? draft : ""}
        onChange={(e) => setDraft(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className="min-h-0 flex-1 resize-none border-0 bg-transparent px-4 py-3 text-[13px] leading-5 text-ink outline-none placeholder:text-ink-mute disabled:cursor-not-allowed disabled:text-ink-mute"
      />
    </div>
  );
}

function AddressContactsSection({
  addressId,
  contacts,
  title,
}: {
  addressId: string;
  contacts: any[];
  title: string;
}) {
  const queryClient = useQueryClient();
  const { t } = useTranslation("ui");
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);
  const contactsQueryKey = ["data", "addressContact", addressId] as const;
  const fallbackContactLabel = t("addressView.contacts.contactFallback");

  const getContactId = useCallback(
    (row: Record<string, any> | null) => row?.contactId || row?.addressContactId || row?.id || null,
    [],
  );

  const getContactLabel = useCallback((contact: any) => {
    const name = [contact.firstName, contact.lastName].filter(Boolean).join(" ");
    const tail = contact.roleFunction ? ` · ${contact.roleFunction}` : "";
    return `${name || contact.email || contact.phoneMobile || fallbackContactLabel}${tail}`;
  }, [fallbackContactLabel]);

  const selectedContact = useMemo(() => {
    if (!selectedContactId) return null;
    return contacts.find((contact: any) => getContactId(contact) === selectedContactId) ?? null;
  }, [contacts, getContactId, selectedContactId]);

  const selectedContactNotiztext =
    selectedContact && typeof selectedContact.notiztext === "string"
      ? selectedContact.notiztext
      : "";

  const { mutate: saveContactNote } = useMutation({
    mutationFn: async ({ contactId, notiztext }: { contactId: string; notiztext: string }) => {
      const res = await fetch(`/api/data/addressContact/${contactId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notiztext }),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json() as Promise<any[]>;
    },
    onMutate: async ({ contactId, notiztext }) => {
      await queryClient.cancelQueries({ queryKey: contactsQueryKey });

      const previousContacts = queryClient.getQueryData<any[]>(contactsQueryKey);
      queryClient.setQueryData<any[]>(
        contactsQueryKey,
        (current) =>
          current?.map((contact) =>
            getContactId(contact) === contactId ? { ...contact, notiztext } : contact,
          ) ?? current,
      );

      return { previousContacts };
    },
    onSuccess: (updatedRows, { contactId, notiztext }) => {
      const updatedRow = updatedRows?.[0] ?? null;
      queryClient.setQueryData<any[]>(
        contactsQueryKey,
        (current) =>
          current?.map((contact) => {
            if (getContactId(contact) !== contactId) return contact;
            return {
              ...contact,
              ...(updatedRow ?? {}),
              notiztext,
            };
          }) ?? current,
      );
      void queryClient.invalidateQueries({ queryKey: contactsQueryKey });
    },
    onError: (error: any, _variables, context) => {
      if (context?.previousContacts) {
        queryClient.setQueryData(contactsQueryKey, context.previousContacts);
      }
      toast.error(error?.message ?? "Notiztext konnte nicht gespeichert werden");
    },
  });

  const handleContactRowSelect = useCallback(
    (row: Record<string, any> | null) => setSelectedContactId(getContactId(row)),
    [getContactId],
  );

  const handleContactNoteChange = useCallback(
    (notiztext: string) => {
      if (!selectedContact) return;
      const contactId = getContactId(selectedContact);
      if (!contactId) return;
      if (notiztext === selectedContactNotiztext) return;

      saveContactNote({
        contactId,
        notiztext,
      });
    },
    [getContactId, saveContactNote, selectedContact, selectedContactNotiztext],
  );

  return (
    <div className="flex flex-col gap-2">
      <div className="text-[11px] font-medium tracking-wider text-ink-mute uppercase">{title}</div>
      <div className="flex flex-col gap-4">
        <InlineEditGrid
          key={`${addressId}-contacts`}
          entityName="addressContact"
          parentKey={{ addressId }}
          keyColumn="contactId"
          className="min-w-0"
          onRowSelect={handleContactRowSelect}
          labels={{
            add: t("addressView.contacts.add"),
            edit: t("addressView.contacts.edit"),
            save: t("addressView.contacts.save"),
            cancel: t("addressView.contacts.cancel"),
            delete: t("addressView.contacts.delete"),
            empty: t("addressView.contacts.empty"),
            records: (count) => t("addressView.contacts.records", { count }),
          }}
          columns={[
            { key: "firstName", header: t("addressView.contacts.firstName"), type: "text" },
            { key: "lastName", header: t("addressView.contacts.lastName"), type: "text", required: true },
            { key: "email", header: t("addressView.contacts.email"), type: "text" },
            { key: "phoneMobile", header: t("addressView.contacts.phoneMobile"), type: "text" },
            { key: "roleFunction", header: t("addressView.contacts.roleFunction"), type: "text" },
            { key: "isPrimary", header: t("addressView.contacts.primary"), type: "boolean", width: "60px" },
          ]}
        />
        <ContactNotizEditor
          key={selectedContactId ?? "empty"}
          contactLabel={selectedContact ? getContactLabel(selectedContact) : ""}
          contactId={selectedContactId}
          initialValue={selectedContactNotiztext}
          title={t("addressView.contacts.noteTitle")}
          emptyLabel={t("addressView.contacts.selectContact")}
          placeholder={t("addressView.contacts.notePlaceholder")}
          onChange={handleContactNoteChange}
          disabled={!selectedContact}
        />
      </div>
    </div>
  );
}

function AddressesModule() {
  const { state: focusState } = useFocus();
  const { registerCommand } = useCommands();
  const { setSubCrumb } = useActionBar();
  const { t } = useTranslation("ui");
  const queryClient = useQueryClient();
  const addressLangtextFields = useMemo(
    () => [
      { field: "notiztext", label: t("addressView.langtexts.note") },
      { field: "warntext", label: t("addressView.langtexts.warning") },
      { field: "langtext", label: t("addressView.langtexts.body") },
    ],
    [t],
  );
  const addressGridRef = useRef<DataGridHandle>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const [activeAddressId, setActiveAddressId] = useState<string | null>(
    focusState.entity === "address" ? focusState.recordId : null,
  );
  const lastSyncIdRef = useRef<string | null>(activeAddressId);

  useEffect(() => {
    if (
      focusState.entity === "address" &&
      focusState.recordId &&
      focusState.recordId !== lastSyncIdRef.current
    ) {
      lastSyncIdRef.current = focusState.recordId;
      setActiveAddressId(focusState.recordId);
    }
  }, [focusState.entity, focusState.recordId]);

  const gridState = useGridUrlState({ defaultPageSize: 50 });

  useEffect(() => () => setSubCrumb(undefined), [setSubCrumb]);

  const restoreAddressGrid = useCallback(
    (recordId?: string | null) => {
      addressGridRef.current?.restoreFocus(recordId ?? activeAddressId ?? null);
    },
    [activeAddressId],
  );

  // Fetch addresses — paginated
  const { data: addressData, isLoading: isDataLoading } = useQuery({
    queryKey: [
      "data",
      "address",
      selectedCategoryId,
      gridState.queryParams.page,
      gridState.queryParams.limit,
      gridState.queryParams.orderBy,
      gridState.queryParams.search,
      gridState.queryParams.filters,
    ],
    queryFn: async () => {
      const p = new URLSearchParams({
        paginated: "true",
        page: String(gridState.queryParams.page),
        limit: String(gridState.queryParams.limit),
      });
      if (selectedCategoryId) p.set("addressCategoryId", selectedCategoryId);
      if (gridState.queryParams.orderBy) p.set("orderBy", gridState.queryParams.orderBy);
      if (gridState.queryParams.search) p.set("search", gridState.queryParams.search);
      if (gridState.queryParams.filters)
        p.set("filters", JSON.stringify(gridState.queryParams.filters));
      const res = await fetch(`/api/data/address?${p}`);
      if (!res.ok) throw new Error("Failed to fetch addresses");
      return res.json() as Promise<{ data: any[]; total: number }>;
    },
  });

  const addresses = useMemo(() => addressData?.data ?? EMPTY_ARRAY, [addressData]);

  // Fetch categories for tree
  const { data: categories = EMPTY_ARRAY, isLoading: isTreeLoading } = useQuery({
    queryKey: ["data", "addressCategory"],
    queryFn: async () => {
      const res = await fetch("/api/data/addressCategory");
      if (!res.ok) throw new Error("Failed to fetch categories");
      return res.json();
    },
    select: useCallback(
      (data: any[]) =>
        data.map(
          (c: any): TreeNode => ({
            id: c.categoryId,
            label: c.name?.en || c.name?.de || c.name || "Unnamed Category",
            count: undefined,
          }),
        ),
      [],
    ),
    placeholderData: keepPreviousData,
  });

  const treeNodes = useMemo<TreeNode[]>(
    () => [{ id: "ALL", label: t("tree.all", { defaultValue: "All" }) }, ...categories],
    [categories, t],
  );

  // Fetch address stats for selected address
  const { data: addressStats } = useQuery<{
    revenueByPeriod: Array<{
      fiscal_year: number;
      period_no: number;
      total_amount_net: string;
      total_profit: string;
    }>;
    recentDocuments: unknown[];
  }>({
    queryKey: ["stats", "address", activeAddressId],
    queryFn: async () => {
      const res = await fetch(`/api/stats/address/${encodeURIComponent(activeAddressId!)}`);
      if (!res.ok) throw new Error("Failed to fetch address stats");
      return res.json();
    },
    enabled: !!activeAddressId,
    placeholderData: keepPreviousData,
  });

  const { data: contacts = EMPTY_ARRAY } = useQuery({
    queryKey: ["data", "addressContact", activeAddressId],
    queryFn: async () => {
      const res = await fetch(`/api/data/addressContact?addressId=${activeAddressId}`);
      if (!res.ok) throw new Error("Failed to fetch contacts");
      return res.json();
    },
    enabled: !!activeAddressId,
    placeholderData: keepPreviousData,
  });

  const { data: deliveryAddresses = EMPTY_ARRAY } = useQuery({
    queryKey: ["data", "deliveryAddress", activeAddressId],
    queryFn: async () => {
      const res = await fetch(`/api/data/deliveryAddress?addressId=${activeAddressId}`);
      if (!res.ok) throw new Error("Failed to fetch delivery addresses");
      return res.json();
    },
    enabled: !!activeAddressId,
    placeholderData: keepPreviousData,
  });

  // Register context commands
  useEffect(() => {
    const unregF3 = registerCommand({
      id: "create-record",
      scope: "context",
      group: "recordOps",
      label: { en: t("commands.newRecord"), de: "Neuer Datensatz" },
      shortcut: "F3",
      isEnabled: () => true,
      handler: () => setShowCreate(true),
    });
    const unregEdit = registerCommand({
      id: "edit-record",
      scope: "context",
      group: "recordOps",
      label: { en: "Edit", de: "Bearbeiten" },
      shortcut: "F2",
      isEnabled: (s) => !!s.recordId && s.entity === "address",
      handler: () => setShowEdit(true),
    });
    const unregF4 = registerCommand({
      id: "delete-record",
      scope: "context",
      group: "recordOps",
      label: { en: t("actions.delete"), de: "Löschen" },
      shortcut: "F4",
      isEnabled: (s) => !!s.recordId && s.entity === "address",
      handler: (s) => {
        if (!s.recordId) return;
        setDeleteId(s.recordId);
        setDeleteConfirm(true);
      },
    });
    const unregDup = registerCommand({
      id: "duplicate-record",
      scope: "context",
      group: "recordOps",
      label: { en: "Duplicate", de: "Duplizieren" },
      shortcut: "F8",
      isEnabled: (s) => !!s.recordId && s.entity === "address",
      handler: async (s) => {
        if (!s.recordId) return;
        const srcRes = await fetch(`/api/data/address/${s.recordId}`);
        if (!srcRes.ok) return;
        const { addressId: _id, ...copy } = await srcRes.json();
        await fetch("/api/data/address", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(copy),
        });
        queryClient.invalidateQueries({ queryKey: ["data", "address"] });
      },
    });
    return () => {
      unregF3();
      unregEdit();
      unregF4();
      unregDup();
    };
  }, [registerCommand, t, queryClient]);

  const selectedAddress = useMemo(
    () => addresses.find((a: any) => a.addressId === activeAddressId),
    [addresses, activeAddressId],
  );

  const dependentTabs = useMemo(
    () => [
      {
        id: "details",
        label: t("addressView.tabs.details"),
        content: (
          <InspectorPanel
            title={selectedAddress?.companyName ?? t("addressView.inspector.title")}
            recordId={activeAddressId ?? undefined}
            sections={[
              {
                title: t("addressView.inspector.identification"),
                fields: [
                  {
                    label: t("addressView.inspector.no"),
                    value: (
                      <span className="font-mono tabular-nums">{selectedAddress?.addressNo}</span>
                    ),
                  },
                  {
                    label: t("addressView.inspector.company"),
                    value: selectedAddress?.companyName,
                  },
                  { label: t("addressView.inspector.type"), value: selectedAddress?.addressType },
                ],
              },
              {
                title: t("addressView.inspector.postalAddress"),
                fields: [
                  {
                    label: t("addressView.inspector.street"),
                    value: selectedAddress?.addressLine1,
                  },
                  { label: t("addressView.inspector.city"), value: selectedAddress?.city },
                  {
                    label: t("addressView.inspector.postalCode"),
                    value: selectedAddress?.postalCode,
                  },
                  {
                    label: t("addressView.inspector.country"),
                    value: selectedAddress?.countryCode,
                  },
                ],
              },
              {
                title: t("addressView.inspector.commercial"),
                fields: [
                  {
                    label: t("addressView.inspector.paymentTerms"),
                    value: selectedAddress?.paymentTermId,
                  },
                  {
                    label: t("addressView.inspector.taxClass"),
                    value: selectedAddress?.taxClassId,
                  },
                  { label: t("addressView.inspector.vatId"), value: selectedAddress?.vatId },
                ],
              },
            ]}
          />
        ),
      },
      {
        id: "langtexte",
        label: t("addressView.tabs.langtexts"),
        content: (
          <div className="h-full p-2">
            <LangTextRecordPanel
              entityName="address"
              recordId={activeAddressId}
              title={t("addressView.tabs.langtexts")}
              fields={addressLangtextFields}
              className="h-full"
            />
          </div>
        ),
      },
      {
        id: "contacts",
        label: t("addressView.tabs.contacts"),
        count: contacts.length || undefined,
        content: (
          <DataGrid
            entityName="addressContact"
            panelId="contacts-grid"
            data={contacts}
            keyExtractor={(row: any) => row.contactId || row.addressContactId || row.id}
            title={t("addressView.tables.contacts")}
            toolbar={false}
            columns={[
              { key: "firstName", header: t("addressView.tables.firstName") },
              { key: "lastName", header: t("addressView.tables.lastName") },
              {
                key: "notiztext",
                header: t("addressView.contacts.noteText"),
                render: (row: any) => (
                  <span className="block max-w-[240px] truncate text-ink-secondary">
                    {row.notiztext ?? "—"}
                  </span>
                ),
              },
              { key: "email", header: t("addressView.contacts.email") },
              { key: "phoneMobile", header: t("addressView.contacts.phoneMobile") },
              { key: "roleFunction", header: t("addressView.contacts.roleFunction") },
            ]}
            emptyTitle={t("addressView.contacts.emptyTitle")}
            emptySubtitle={t("addressView.contacts.emptySubtitle")}
            className="h-full rounded-none border-none"
          />
        ),
      },
      {
        id: "deliveryAddresses",
        label: t("addressView.tabs.deliveryAddresses"),
        count: deliveryAddresses.length || undefined,
        content: (
          <DataGrid
            entityName="deliveryAddress"
            panelId="delivery-addresses-grid"
            data={deliveryAddresses}
            keyExtractor={(row: any) => row.deliveryAddressId || row.id}
            title={t("addressView.tables.deliveryAddresses")}
            toolbar={false}
            columns={[
              { key: "name", header: t("addressView.tables.name") },
              { key: "addressLine1", header: t("addressView.tables.street") },
              { key: "postalCode", header: t("addressView.tables.zip") },
              { key: "city", header: t("addressView.tables.city") },
              { key: "countryCode", header: t("addressView.tables.country") },
            ]}
            emptyTitle={t("addressView.deliveryAddresses.emptyTitle")}
            emptySubtitle={t("addressView.deliveryAddresses.emptySubtitle")}
            className="h-full rounded-none border-none"
          />
        ),
      },
      {
        id: "relatedDocuments",
        label: t("addressView.tabs.relatedDocuments"),
        count: addressStats?.recentDocuments?.length || undefined,
        content: (
          <DataGrid
            entityName="document"
            panelId="related-documents-grid"
            data={(addressStats?.recentDocuments ?? []) as any[]}
            keyExtractor={(row: any) => row.documentId || row.id}
            title={t("addressView.tables.relatedDocuments")}
            toolbar={false}
            columns={[
              {
                key: "documentNo",
                header: t("addressView.tables.no"),
                render: (r: any) => <span className="font-mono tabular-nums">{r.documentNo}</span>,
              },
              {
                key: "documentDate",
                header: t("addressView.tables.date"),
                isNumeric: true,
                render: (r: any) => (
                  <span className="tabular-nums">{formatDate(r.documentDate)}</span>
                ),
              },
              { key: "documentType", header: t("addressView.tables.type") },
              {
                key: "totalGross",
                header: t("addressView.tables.total"),
                isNumeric: true,
                render: (r: any) => (
                  <span className="tabular-nums">{formatMoney(r.totalGross ?? 0)}</span>
                ),
              },
              {
                key: "status",
                header: t("addressView.tables.status"),
                render: (r: any) => <StatusDot status={r.status ?? "draft"} />,
              },
            ]}
            emptyTitle={t("addressView.relatedDocuments.emptyTitle")}
            emptySubtitle={t("addressView.relatedDocuments.emptySubtitle")}
            className="h-full rounded-none border-none"
          />
        ),
      },
      {
        id: "statistics",
        label: t("stats.revenue"),
        content: (
          <div className="h-full overflow-auto">
            {!addressStats || addressStats.revenueByPeriod.length === 0 ? (
              <div className="flex h-24 items-center justify-center text-[13px] text-ink-mute">
                {t("empty.title")}
              </div>
            ) : (
              <table className="w-full table-fixed border-collapse">
                <thead>
                  <tr className="h-8 border-b border-hairline">
                    <th className="px-3 py-0 text-left text-[11px] font-medium tracking-wider text-ink-mute uppercase">
                      {t("stats.fiscalYear")}
                    </th>
                    <th className="px-3 py-0 text-left text-[11px] font-medium tracking-wider text-ink-mute uppercase">
                      {t("stats.period")}
                    </th>
                    <th className="px-3 py-0 text-right text-[11px] font-medium tracking-wider text-ink-mute uppercase">
                      {t("stats.revenue")}
                    </th>
                    <th className="px-3 py-0 text-right text-[11px] font-medium tracking-wider text-ink-mute uppercase">
                      {t("stats.profit")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {addressStats.revenueByPeriod.map((row) => (
                    <tr
                      key={`${row.fiscal_year}-${row.period_no}`}
                      className="h-9 border-b border-hairline last:border-0"
                    >
                      <td className="px-3 text-[13px] tabular-nums">{row.fiscal_year}</td>
                      <td className="px-3 text-[13px] tabular-nums">{row.period_no}</td>
                      <td className="px-3 text-right font-mono text-[13px] tabular-nums">
                        {new Intl.NumberFormat("de-DE", {
                          style: "currency",
                          currency: "EUR",
                        }).format(Number(row.total_amount_net))}
                      </td>
                      <td className="px-3 text-right font-mono text-[13px] tabular-nums">
                        {new Intl.NumberFormat("de-DE", {
                          style: "currency",
                          currency: "EUR",
                        }).format(Number(row.total_profit))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        ),
      },
      {
        id: "open-items",
        label: t("addressView.tabs.openItems"),
        content: (
          <DataGrid
            entityName="document"
            panelId="open-items-grid"
            data={(addressStats?.recentDocuments ?? []).filter((d: any) => !d.isPaid) as any[]}
            keyExtractor={(row: any) => row.documentId || row.id}
            title={t("addressView.tabs.openItems")}
            toolbar={false}
            columns={[
              {
                key: "documentDate",
                header: t("addressView.tables.date"),
                isNumeric: false,
                render: (r: any) => (
                  <span className="tabular-nums">{formatDate(r.documentDate)}</span>
                ),
              },
              {
                key: "documentNo",
                header: t("addressView.tables.no"),
                render: (r: any) => <span className="font-mono tabular-nums">{r.documentNo}</span>,
              },
              { key: "documentType", header: t("addressView.tables.type") },
              {
                key: "totalGross",
                header: t("addressView.tables.total"),
                isNumeric: true,
                render: (r: any) => (
                  <span className="tabular-nums">{formatMoney(r.totalGross ?? 0)}</span>
                ),
              },
              {
                key: "status",
                header: t("addressView.tables.status"),
                render: (r: any) => <StatusDot status={r.status ?? "draft"} />,
              },
            ]}
            emptyTitle={t("addressView.openItems.emptyTitle")}
            emptySubtitle={t("addressView.openItems.emptySubtitle")}
            className="h-full rounded-none border-none"
          />
        ),
      },
    ],
    [selectedAddress, activeAddressId, contacts, deliveryAddresses, addressStats, t, addressLangtextFields],
  );

  const selectCategoryNode = useCallback(
    (id: string) => {
      const cat = treeNodes.find((c: TreeNode) => c.id === id);
      setSubCrumb(cat?.label);
      setSelectedCategoryId(id === "ALL" ? null : id);
      gridState.setPage(1);
    },
    [treeNodes, gridState, setSubCrumb],
  );

  const modalOpen = showCreate || showEdit || deleteConfirm;

  useEffect(() => {
    const navigateTree = (delta: number) => {
      if (treeNodes.length === 0) return;
      const currentId = selectedCategoryId ?? "ALL";
      const currentIndex = treeNodes.findIndex((node) => node.id === currentId);
      const base = currentIndex < 0 ? (delta > 0 ? -1 : treeNodes.length) : currentIndex;
      const nextIndex = (base + delta + treeNodes.length) % treeNodes.length;
      const nextNode = treeNodes[nextIndex];
      if (!nextNode) return;
      selectCategoryNode(nextNode.id);
      restoreAddressGrid();
    };

    const unregDown = registerCommand({
      id: "address-tree-nav-down",
      scope: "context",
      group: "navigation",
      label: { en: "Next Tree Item", de: "Nächster Eintrag" },
      shortcut: "Ctrl+ArrowDown",
      isEnabled: () => !modalOpen && treeNodes.length > 0,
      handler: () => navigateTree(1),
    });
    const unregUp = registerCommand({
      id: "address-tree-nav-up",
      scope: "context",
      group: "navigation",
      label: { en: "Previous Tree Item", de: "Vorheriger Eintrag" },
      shortcut: "Ctrl+ArrowUp",
      isEnabled: () => !modalOpen && treeNodes.length > 0,
      handler: () => navigateTree(-1),
    });

    return () => {
      unregDown();
      unregUp();
    };
  }, [
    modalOpen,
    registerCommand,
    restoreAddressGrid,
    selectCategoryNode,
    selectedCategoryId,
    treeNodes,
    treeNodes.length,
  ]);

  const handleCreateSaved = useCallback(
    (record: any) => {
      setShowCreate(false);
      queryClient.invalidateQueries({ queryKey: ["data", "address"] });
      restoreAddressGrid(record?.addressId ?? record?.id ?? null);
    },
    [queryClient, restoreAddressGrid],
  );

  const handleEditSaved = useCallback(
    (record: any) => {
      setShowEdit(false);
      queryClient.invalidateQueries({ queryKey: ["data", "address"] });
      restoreAddressGrid(record?.addressId ?? record?.id ?? activeAddressId);
    },
    [activeAddressId, queryClient, restoreAddressGrid],
  );

  return (
    <>
      <TriViewWorkspace
        navigationTree={
          <NavigationTree
            entityName="addressCategory"
            panelId="address-tree"
            data={treeNodes}
            header={t("tree.categories")}
            isLoading={isTreeLoading}
            defaultExpandDepth={2}
            onSelect={selectCategoryNode}
            onSelectCommit={() => restoreAddressGrid()}
          />
        }
        primaryGrid={
          <DataGrid
            ref={addressGridRef}
            entityName="address"
            panelId="address-grid"
            virtualized
            data={addresses}
            isLoading={isDataLoading}
            keyExtractor={(row: any) => row.addressId}
            title={t("nav.addresses")}
            columns={[
              {
                key: "addressNo",
                header: t("addressView.tables.no"),
                sortable: true,
                render: (r: any) => (
                  <span className="font-mono text-ink-mute tabular-nums">{r.addressNo}</span>
                ),
              },
              { key: "companyName", header: t("addressView.tables.company"), sortable: true },
              { key: "city", header: t("addressView.tables.city"), sortable: true },
              { key: "countryCode", header: t("addressView.tables.country") },
              {
                key: "isCustomer",
                header: t("addressView.tables.type"),
                render: (r: any) => {
                  const tags = [r.isCustomer && "C", r.isSupplier && "S"].filter(Boolean).join("/");
                  return <span className="font-mono text-[11px] text-ink-mute">{tags || "—"}</span>;
                },
              },
              { key: "addressType", header: t("addressView.tables.segment"), sortable: true },
            ]}
            totalCount={addressData?.total}
            page={gridState.page}
            pageSize={gridState.pageSize}
            sort={gridState.sort}
            onPageChange={gridState.setPage}
            onPageSizeChange={gridState.setPageSize}
            onSortChange={gridState.setSort}
            search={gridState.search}
            onSearchChange={gridState.setSearch}
            filters={gridState.filters}
            onFiltersChange={gridState.setFilters}
            selectable
            bulkActions={[
              {
                label: t("actions.delete"),
                variant: "destructive" as const,
                onClick: async (keys: string[]) => {
                  try {
                    await Promise.all(
                      keys.map(async (id) => {
                        const res = await fetch(`/api/data/address/${id}`, {
                          method: "DELETE",
                        });
                        if (!res.ok) throw new Error(await res.text());
                      }),
                    );
                    queryClient.invalidateQueries({ queryKey: ["data", "address"] });
                  } catch (err) {
                    toast.error(
                      err instanceof Error && err.message
                        ? err.message
                        : t("form.fkViolationError"),
                    );
                  }
                },
              },
            ]}
            onRowOpen={() => setShowEdit(true)}
            emptyTitle={t("addressView.addressList.emptyTitle")}
            emptySubtitle={t("addressView.addressList.emptySubtitle")}
            emptyAction={{
              label: `${t("actions.new")} ${t("nav.addresses")}`,
              kbd: "F3",
              onClick: () => setShowCreate(true),
            }}
            className="h-full rounded-none border-none"
          />
        }
        dependentContext={<ContextTabs tabs={dependentTabs} />}
      />

      {/* Create dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-2xl overflow-hidden p-0">
          <EntityMask
            entityName="address"
            mode="create"
            layout="single"
            title={t("addressView.dialog.newAddress")}
            onCancel={() => setShowCreate(false)}
            onSaved={handleCreateSaved}
            className="rounded-none border-none shadow-none"
            fieldOverrides={ADDRESS_FIELD_OVERRIDES_ALL}
          />
        </DialogContent>
      </Dialog>

      {/* Delete confirm dialog */}
      <Dialog open={deleteConfirm} onOpenChange={setDeleteConfirm}>
        <DialogContent className="max-w-sm">
          <div className="flex flex-col gap-5 p-6">
            <div>
              <h3 className="text-[15px] font-medium text-ink">{t("form.deleteConfirmTitle")}</h3>
              <p className="mt-1 text-[13px] text-ink-mute">{t("form.deleteConfirmBody")}</p>
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              <button
                type="button"
                className="h-8 rounded border border-hairline px-4 text-[13px] hover:bg-canvas-soft"
                onClick={() => setDeleteConfirm(false)}
              >
                {t("actions.cancel")}
              </button>
              <button
                type="button"
                className="h-8 rounded bg-destructive px-4 text-[13px] text-white hover:opacity-90"
                onClick={async () => {
                  if (!deleteId) return;
                  const res = await fetch(`/api/data/address/${deleteId}`, {
                    method: "DELETE",
                  });
                  if (!res.ok) {
                    const message = await res.text();
                    toast.error(message || t("form.fkViolationError"));
                    return;
                  }
                  setDeleteConfirm(false);
                  setDeleteId(null);
                  queryClient.invalidateQueries({ queryKey: ["data", "address"] });
                  toast.success(t("form.deleteSuccess"));
                }}
              >
                {t("actions.delete")}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={showEdit} onOpenChange={setShowEdit}>
        <DialogContent className="h-[85vh] max-w-7xl overflow-hidden p-0">
          <EntityMask
            entityName="address"
            mode="edit"
            layout="single"
            recordId={activeAddressId ?? undefined}
            onCancel={() => setShowEdit(false)}
            onSaved={handleEditSaved}
            fieldOverrides={ADDRESS_FIELD_OVERRIDES_ALL}
            embedded
            childLayout="side"
            childSection={(record, onChange) => (
              <div className="flex flex-col gap-6">
                <div>
                  <div className="mb-2 text-[11px] font-medium tracking-wider text-ink-mute uppercase">
                    {t("langtextEditor.title", { defaultValue: "Langtexte" })}
                  </div>
                  <LangTextRecordPanel
                    entityName="address"
                    recordId={activeAddressId}
                    title={t("langtextEditor.title", { defaultValue: "Langtexte" })}
                    fields={addressLangtextFields}
                    className="min-h-[220px]"
                    controlledValues={{
                      notiztext: record.notiztext as string,
                      warntext: record.warntext as string,
                      langtext: record.langtext as string,
                    }}
                    onControlledChange={(field, value) => onChange(field, value)}
                  />
                </div>
                <AddressContactsSection
                  key={record.addressId as string}
                  addressId={record.addressId as string}
                  contacts={contacts}
                  title={t("addressView.contacts.title")}
                />
                <div>
                  <div className="mb-2 text-[11px] font-medium tracking-wider text-ink-mute uppercase">
                    {t("addressView.sections.deliveryAddresses")}
                  </div>
                  <InlineEditGrid
                    key={`${record.addressId as string}-delivery-addresses`}
                    entityName="deliveryAddress"
                    parentKey={{ addressId: record.addressId as string }}
                    keyColumn="deliveryAddressId"
                    columns={[
                      { key: "name", header: t("addressView.tables.name"), type: "text" },
                      {
                        key: "addressLine1",
                        header: t("addressView.tables.street"),
                        type: "text",
                        required: true,
                      },
                      {
                        key: "postalCode",
                        header: t("addressView.tables.zip"),
                        type: "text",
                        required: true,
                        width: "80px",
                      },
                      { key: "city", header: t("addressView.tables.city"), type: "text", required: true },
                      {
                        key: "countryCode",
                        header: t("addressView.tables.country"),
                        type: "text",
                        required: true,
                        width: "70px",
                      },
                      {
                        key: "defaultForShipping",
                        header: t("addressView.tables.default"),
                        type: "boolean",
                        width: "60px",
                      },
                    ]}
                  />
                </div>
                <div>
                  <div className="mb-2 text-[11px] font-medium tracking-wider text-ink-mute uppercase">
                    {t("addressView.sections.bankAccounts")}
                  </div>
                  <InlineEditGrid
                    key={`${record.addressId as string}-bank-accounts`}
                    entityName="bankAccount"
                    parentKey={{ addressId: record.addressId as string }}
                    keyColumn="bankAccountId"
                    columns={[
                      { key: "iban", header: t("addressView.tables.iban"), type: "text", required: true },
                      { key: "bic", header: t("addressView.tables.bic"), type: "text" },
                      { key: "bankName", header: t("addressView.tables.bank"), type: "text" },
                      { key: "isDefault", header: t("addressView.tables.default"), type: "boolean", width: "60px" },
                    ]}
                  />
                </div>
                {!!record.isCustomer && (
                  <CustomerStatsSection addressId={record.addressId as string} />
                )}
              </div>
            )}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
