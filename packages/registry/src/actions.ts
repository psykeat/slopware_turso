// Registry-owned generic entity action projection.
// Strings only: safe to import from client bundles (no handlers, no Drizzle).
import type { EntityActionManifest } from "./action-types";

export type {
  EntityActionEntry,
  EntityActionManifest,
  EntityActionOperation,
} from "./action-types";

export const entityActionManifest: EntityActionManifest = {
  accountDeterminationRule: {
    module: "accounting",
    ops: {
      create: { key: "accounting.accountDeterminationRule.create" },
      get: { key: "accounting.accountDeterminationRule.get", idParam: "id" },
      list: { key: "accounting.accountDeterminationRule.list", filtersWrapped: true },
      update: { key: "accounting.accountDeterminationRule.update", idParam: "id" },
    },
  },
  accountingExportBatch: {
    module: "accounting",
    ops: {
      buildRows: { key: "accounting.accountingExportBatch.buildRows" },
      createBatch: { key: "accounting.accountingExportBatch.createBatch" },
      csv: { key: "accounting.accountingExportBatch.csv" },
      get: { key: "accounting.accountingExportBatch.get", idParam: "batchId" },
      list: { key: "accounting.accountingExportBatch.list", filtersWrapped: false },
      markExported: { key: "accounting.accountingExportBatch.markExported" },
      rebuild: { key: "accounting.accountingExportBatch.rebuild" },
    },
  },
  accountingExportRow: {
    module: "accounting",
    ops: {
      create: { key: "accounting.accountingExportRow.create" },
      get: { key: "accounting.accountingExportRow.get", idParam: "id" },
      list: { key: "accounting.accountingExportRow.list", filtersWrapped: true },
      update: { key: "accounting.accountingExportRow.update", idParam: "id" },
    },
  },
  address: {
    module: "masterdata",
    ops: {
      archive: { key: "masterdata.address.archive", idParam: "addressId" },
      create: { key: "masterdata.address.create" },
      geocode: { key: "masterdata.address.geocode" },
      get: { key: "masterdata.address.get", idParam: "addressId" },
      list: { key: "masterdata.address.list", filtersWrapped: false },
      search: { key: "masterdata.address.search" },
      update: { key: "masterdata.address.update", idParam: "addressId" },
      upsert: { key: "masterdata.address.upsert" },
    },
  },
  addressCategory: {
    module: "masterdata",
    ops: {
      archive: { key: "masterdata.addressCategory.archive", idParam: "id" },
      create: { key: "masterdata.addressCategory.create" },
      get: { key: "masterdata.addressCategory.get", idParam: "id" },
      list: { key: "masterdata.addressCategory.list", filtersWrapped: true },
      update: { key: "masterdata.addressCategory.update", idParam: "id" },
    },
  },
  addressContact: {
    module: "masterdata",
    ops: {
      archive: { key: "masterdata.addressContact.archive", idParam: "id" },
      create: { key: "masterdata.addressContact.create" },
      get: { key: "masterdata.addressContact.get", idParam: "id" },
      list: { key: "masterdata.addressContact.list", filtersWrapped: true },
      search: { key: "masterdata.addressContact.search" },
      update: { key: "masterdata.addressContact.update", idParam: "id" },
    },
  },
  agent: {
    module: "masterdata",
    ops: {
      archive: { key: "masterdata.agent.archive", idParam: "agentId" },
      get: { key: "masterdata.agent.get", idParam: "agentId" },
      linkAddresses: { key: "masterdata.agent.linkAddresses" },
      list: { key: "masterdata.agent.list", filtersWrapped: false },
      upsert: { key: "masterdata.agent.upsert" },
    },
  },
  article: {
    module: "masterdata",
    ops: {
      archive: { key: "masterdata.article.archive", idParam: "articleId" },
      create: { key: "masterdata.article.create" },
      get: { key: "masterdata.article.get", idParam: "articleId" },
      list: { key: "masterdata.article.list", filtersWrapped: false },
      search: { key: "masterdata.article.search" },
      update: { key: "masterdata.article.update", idParam: "articleId" },
      upsert: { key: "masterdata.article.upsert" },
    },
  },
  articleBom: {
    module: "masterdata",
    ops: {
      archive: { key: "masterdata.articleBom.archive", idParam: "bomId" },
      create: { key: "masterdata.articleBom.create" },
      get: { key: "masterdata.articleBom.get", idParam: "bomId" },
      list: { key: "masterdata.articleBom.list", filtersWrapped: false },
      update: { key: "masterdata.articleBom.update", idParam: "bomId" },
    },
  },
  articleCategory: {
    module: "masterdata",
    ops: {
      archive: { key: "masterdata.articleCategory.archive", idParam: "articleCategoryId" },
      create: { key: "masterdata.articleCategory.create" },
      get: { key: "masterdata.articleCategory.get", idParam: "articleCategoryId" },
      list: { key: "masterdata.articleCategory.list", filtersWrapped: false },
      update: { key: "masterdata.articleCategory.update", idParam: "articleCategoryId" },
    },
  },
  articleGroup: {
    module: "masterdata",
    ops: {
      archive: { key: "masterdata.articleGroup.archive", idParam: "articleGroupId" },
      create: { key: "masterdata.articleGroup.create" },
      get: { key: "masterdata.articleGroup.get", idParam: "articleGroupId" },
      list: { key: "masterdata.articleGroup.list", filtersWrapped: false },
      update: { key: "masterdata.articleGroup.update", idParam: "articleGroupId" },
      upsert: { key: "masterdata.articleGroup.upsert" },
    },
  },
  articleImage: {
    module: "masterdata",
    ops: {
      archive: { key: "masterdata.articleImage.archive", idParam: "articleImageId" },
      create: { key: "masterdata.articleImage.create" },
      get: { key: "masterdata.articleImage.get", idParam: "articleImageId" },
      list: { key: "masterdata.articleImage.list", filtersWrapped: false },
      update: { key: "masterdata.articleImage.update", idParam: "articleImageId" },
    },
  },
  articleMedia: {
    module: "masterdata",
    ops: {
      archive: { key: "masterdata.articleMedia.archive", idParam: "articleMediaId" },
      create: { key: "masterdata.articleMedia.create" },
      get: { key: "masterdata.articleMedia.get", idParam: "articleMediaId" },
      list: { key: "masterdata.articleMedia.list", filtersWrapped: false },
      update: { key: "masterdata.articleMedia.update", idParam: "articleMediaId" },
    },
  },
  articleOption: {
    module: "masterdata",
    ops: {
      archive: { key: "masterdata.articleOption.archive", idParam: "optionId" },
      create: { key: "masterdata.articleOption.create" },
      get: { key: "masterdata.articleOption.get", idParam: "optionId" },
      list: { key: "masterdata.articleOption.list", filtersWrapped: false },
      update: { key: "masterdata.articleOption.update", idParam: "optionId" },
    },
  },
  articleOptionValue: {
    module: "masterdata",
    ops: {
      archive: { key: "masterdata.articleOptionValue.archive", idParam: "valueId" },
      create: { key: "masterdata.articleOptionValue.create" },
      get: { key: "masterdata.articleOptionValue.get", idParam: "valueId" },
      list: { key: "masterdata.articleOptionValue.list", filtersWrapped: false },
      update: { key: "masterdata.articleOptionValue.update", idParam: "valueId" },
    },
  },
  articleVariant: {
    module: "masterdata",
    ops: {
      archive: { key: "masterdata.articleVariant.archive" },
      archiveBulk: { key: "masterdata.articleVariant.archiveBulk" },
      copyVariantAxes: { key: "masterdata.articleVariant.copyVariantAxes" },
      generateVariants: { key: "masterdata.articleVariant.generateVariants" },
      get: { key: "masterdata.articleVariant.get", idParam: "variantId" },
      list: { key: "masterdata.articleVariant.list", filtersWrapped: false },
      previewVariants: { key: "masterdata.articleVariant.previewVariants" },
      pricing: { key: "masterdata.articleVariant.pricing" },
      update: { key: "masterdata.articleVariant.update", idParam: "variantId" },
    },
  },
  articleVariantOptionValue: {
    module: "masterdata",
    ops: {
      create: { key: "masterdata.articleVariantOptionValue.create" },
      delete: { key: "masterdata.articleVariantOptionValue.delete" },
      get: { key: "masterdata.articleVariantOptionValue.get" },
      list: { key: "masterdata.articleVariantOptionValue.list", filtersWrapped: false },
    },
  },
  articleVariantTemplate: {
    module: "masterdata",
    ops: {
      applyToArticle: { key: "masterdata.articleVariantTemplate.applyToArticle" },
      create: { key: "masterdata.articleVariantTemplate.create" },
      get: { key: "masterdata.articleVariantTemplate.get", idParam: "templateId" },
      list: { key: "masterdata.articleVariantTemplate.list", filtersWrapped: false },
      update: { key: "masterdata.articleVariantTemplate.update", idParam: "templateId" },
    },
  },
  bankAccount: {
    module: "masterdata",
    ops: {
      archive: { key: "masterdata.bankAccount.archive", idParam: "id" },
      create: { key: "masterdata.bankAccount.create" },
      get: { key: "masterdata.bankAccount.get", idParam: "id" },
      list: { key: "masterdata.bankAccount.list", filtersWrapped: true },
      update: { key: "masterdata.bankAccount.update", idParam: "id" },
    },
  },
  bueroware: {
    module: "import",
    ops: {
      bootstrap: { key: "import.bueroware.bootstrap" },
      getLayoutFields: { key: "import.bueroware.getLayoutFields" },
      listLayouts: { key: "import.bueroware.listLayouts" },
      listTemplates: { key: "import.bueroware.listTemplates" },
      loadCatalog: { key: "import.bueroware.loadCatalog" },
      queueFile: { key: "import.bueroware.queueFile" },
      reconcile: { key: "import.bueroware.reconcile" },
      runNextJob: { key: "import.bueroware.runNextJob" },
      saveTemplate: { key: "import.bueroware.saveTemplate" },
      selectLayout: { key: "import.bueroware.selectLayout" },
    },
  },
  category: {
    module: "masterdata",
    ops: {
      archive: { key: "masterdata.category.archive", idParam: "categoryId" },
      create: { key: "masterdata.category.create" },
      get: { key: "masterdata.category.get", idParam: "categoryId" },
      list: { key: "masterdata.category.list", filtersWrapped: false },
      update: { key: "masterdata.category.update", idParam: "categoryId" },
    },
  },
  commerceSyncDeadLetter: {
    module: "commerce",
    ops: {
      list: { key: "commerce.commerceSyncDeadLetter.list", filtersWrapped: false },
      retry: { key: "commerce.commerceSyncDeadLetter.retry" },
    },
  },
  commerceSyncRun: {
    module: "commerce",
    ops: {
      cancel: { key: "commerce.commerceSyncRun.cancel" },
      get: { key: "commerce.commerceSyncRun.get", idParam: "runId" },
      list: { key: "commerce.commerceSyncRun.list", filtersWrapped: false },
      start: { key: "commerce.commerceSyncRun.start" },
    },
  },
  commerceWebhookEvent: {
    module: "commerce",
    ops: {
      list: { key: "commerce.commerceWebhookEvent.list", filtersWrapped: false },
      process: { key: "commerce.commerceWebhookEvent.process" },
    },
  },
  company: {
    module: "system",
    ops: {
      archive: { key: "system.company.archive", idParam: "id" },
      create: { key: "system.company.create" },
      get: { key: "system.company.get", idParam: "id" },
      list: { key: "system.company.list", filtersWrapped: true },
      update: { key: "system.company.update", idParam: "id" },
    },
  },
  connectorDefinition: {
    module: "system",
    ops: {
      create: { key: "system.connectorDefinition.create" },
      get: { key: "system.connectorDefinition.get", idParam: "id" },
      list: { key: "system.connectorDefinition.list", filtersWrapped: true },
      update: { key: "system.connectorDefinition.update", idParam: "id" },
    },
  },
  costCenter: {
    module: "masterdata",
    ops: {
      archive: { key: "masterdata.costCenter.archive", idParam: "id" },
      create: { key: "masterdata.costCenter.create" },
      get: { key: "masterdata.costCenter.get", idParam: "id" },
      list: { key: "masterdata.costCenter.list", filtersWrapped: true },
      update: { key: "masterdata.costCenter.update", idParam: "id" },
    },
  },
  country: {
    module: "masterdata",
    ops: {
      archive: { key: "masterdata.country.archive", idParam: "countryId" },
      create: { key: "masterdata.country.create" },
      get: { key: "masterdata.country.get", idParam: "countryId" },
      list: { key: "masterdata.country.list", filtersWrapped: false },
      update: { key: "masterdata.country.update", idParam: "countryId" },
      upsert: { key: "masterdata.country.upsert" },
    },
  },
  currency: {
    module: "masterdata",
    ops: {
      archive: { key: "masterdata.currency.archive", idParam: "currencyId" },
      create: { key: "masterdata.currency.create" },
      get: { key: "masterdata.currency.get", idParam: "currencyId" },
      list: { key: "masterdata.currency.list", filtersWrapped: false },
      update: { key: "masterdata.currency.update", idParam: "currencyId" },
      upsert: { key: "masterdata.currency.upsert" },
    },
  },
  deliveryAddress: {
    module: "masterdata",
    ops: {
      archive: { key: "masterdata.deliveryAddress.archive", idParam: "deliveryAddressId" },
      create: { key: "masterdata.deliveryAddress.create" },
      get: { key: "masterdata.deliveryAddress.get", idParam: "deliveryAddressId" },
      list: { key: "masterdata.deliveryAddress.list", filtersWrapped: false },
      search: { key: "masterdata.deliveryAddress.search" },
      update: { key: "masterdata.deliveryAddress.update", idParam: "deliveryAddressId" },
    },
  },
  document: {
    module: "sales",
    ops: {
      audit: { key: "sales.document.audit" },
      convert: { key: "sales.document.convert" },
      convertCandidates: { key: "sales.document.convertCandidates" },
      create: { key: "sales.document.create" },
      delete: { key: "sales.document.delete", idParam: "documentId" },
      delta: { key: "sales.document.delta" },
      duplicate: { key: "sales.document.duplicate" },
      duplicateCandidates: { key: "sales.document.duplicateCandidates" },
      get: { key: "sales.document.get", idParam: "documentId" },
      list: { key: "sales.document.list", filtersWrapped: false },
      materializePdf: { key: "sales.document.materializePdf" },
      post: { key: "sales.document.post" },
      pricing: { key: "sales.document.pricing" },
      saveDraft: { key: "sales.document.saveDraft" },
      shipment: { key: "sales.document.shipment" },
      storno: { key: "sales.document.storno" },
      tree: { key: "sales.document.tree" },
      update: { key: "sales.document.update", idParam: "documentId" },
    },
  },
  documentGroup: {
    module: "sales",
    ops: {
      get: { key: "sales.documentGroup.get", idParam: "id" },
      list: { key: "sales.documentGroup.list", filtersWrapped: true },
    },
  },
  documentLine: {
    module: "sales",
    ops: {
      archive: { key: "sales.documentLine.archive", idParam: "id" },
      create: { key: "sales.documentLine.create" },
      delta: { key: "sales.documentLine.delta" },
      get: { key: "sales.documentLine.get", idParam: "id" },
      list: { key: "sales.documentLine.list", filtersWrapped: false },
      tracking: { key: "sales.documentLine.tracking" },
      update: { key: "sales.documentLine.update", idParam: "id" },
    },
  },
  documentLineAllocation: {
    module: "sales",
    ops: {
      create: { key: "sales.documentLineAllocation.create" },
      get: { key: "sales.documentLineAllocation.get", idParam: "id" },
      list: { key: "sales.documentLineAllocation.list", filtersWrapped: false },
      update: { key: "sales.documentLineAllocation.update", idParam: "id" },
    },
  },
  documentLineTracking: {
    module: "sales",
    ops: {
      add: { key: "sales.documentLineTracking.add" },
      create: { key: "sales.documentLineTracking.create" },
      get: { key: "sales.documentLineTracking.get", idParam: "id" },
      list: { key: "sales.documentLineTracking.list", filtersWrapped: false },
      remove: { key: "sales.documentLineTracking.remove" },
      update: { key: "sales.documentLineTracking.update", idParam: "id" },
    },
  },
  documentShipment: {
    module: "logistics",
    ops: {
      exportCsv: { key: "logistics.documentShipment.exportCsv" },
      get: { key: "logistics.documentShipment.get", idParam: "documentId" },
      importTrackingCsv: { key: "logistics.documentShipment.importTrackingCsv" },
      list: { key: "logistics.documentShipment.list", filtersWrapped: true },
      savePackages: { key: "logistics.documentShipment.savePackages" },
      update: { key: "logistics.documentShipment.update", idParam: "documentId" },
    },
  },
  documentShipmentPackage: {
    module: "logistics",
    ops: {
      get: { key: "logistics.documentShipmentPackage.get", idParam: "id" },
      list: { key: "logistics.documentShipmentPackage.list", filtersWrapped: false },
      update: { key: "logistics.documentShipmentPackage.update", idParam: "id" },
    },
  },
  documentType: {
    module: "sales",
    ops: {
      get: { key: "sales.documentType.get", idParam: "id" },
      list: { key: "sales.documentType.list", filtersWrapped: true },
    },
  },
  emailAccount: {
    module: "communication",
    ops: {
      list: { key: "communication.emailAccount.list", filtersWrapped: false },
    },
  },
  emailOutbox: {
    module: "communication",
    ops: {
      composeDefaults: { key: "communication.emailOutbox.composeDefaults" },
      confirmSend: { key: "communication.emailOutbox.confirmSend" },
      prepareSend: { key: "communication.emailOutbox.prepareSend" },
    },
  },
  emailTemplate: {
    module: "communication",
    ops: {
      archive: { key: "communication.emailTemplate.archive", idParam: "id" },
      create: { key: "communication.emailTemplate.create" },
      get: { key: "communication.emailTemplate.get", idParam: "id" },
      list: { key: "communication.emailTemplate.list", filtersWrapped: true },
      update: { key: "communication.emailTemplate.update", idParam: "id" },
    },
  },
  emailTemplateBinding: {
    module: "communication",
    ops: {
      archive: { key: "communication.emailTemplateBinding.archive", idParam: "id" },
      create: { key: "communication.emailTemplateBinding.create" },
      get: { key: "communication.emailTemplateBinding.get", idParam: "id" },
      list: { key: "communication.emailTemplateBinding.list", filtersWrapped: true },
      update: { key: "communication.emailTemplateBinding.update", idParam: "id" },
    },
  },
  emailTemplateRenderLog: {
    module: "communication",
    ops: {
      get: { key: "communication.emailTemplateRenderLog.get", idParam: "id" },
      list: { key: "communication.emailTemplateRenderLog.list", filtersWrapped: true },
    },
  },
  emailThread: {
    module: "communication",
    ops: {
      archive: { key: "communication.emailThread.archive", idParam: "threadId" },
      get: { key: "communication.emailThread.get", idParam: "threadId" },
      link: { key: "communication.emailThread.link" },
      list: { key: "communication.emailThread.list", filtersWrapped: false },
      markRead: { key: "communication.emailThread.markRead" },
    },
  },
  fiscalPeriod: {
    module: "masterdata",
    ops: {
      create: { key: "masterdata.fiscalPeriod.create" },
      get: { key: "masterdata.fiscalPeriod.get", idParam: "id" },
      list: { key: "masterdata.fiscalPeriod.list", filtersWrapped: true },
      update: { key: "masterdata.fiscalPeriod.update", idParam: "id" },
    },
  },
  glAccount: {
    module: "accounting",
    ops: {
      archive: { key: "accounting.glAccount.archive", idParam: "id" },
      create: { key: "accounting.glAccount.create" },
      get: { key: "accounting.glAccount.get", idParam: "id" },
      list: { key: "accounting.glAccount.list", filtersWrapped: true },
      update: { key: "accounting.glAccount.update", idParam: "id" },
    },
  },
  importBatch: {
    module: "import",
    ops: {
      approve: { key: "import.importBatch.approve" },
      get: { key: "import.importBatch.get", idParam: "batchId" },
      list: { key: "import.importBatch.list", filtersWrapped: false },
      post: { key: "import.importBatch.post" },
      upload: { key: "import.importBatch.upload" },
    },
  },
  importProfile: {
    module: "import",
    ops: {
      activateMapping: { key: "import.importProfile.activateMapping" },
      create: { key: "import.importProfile.create" },
      list: { key: "import.importProfile.list", filtersWrapped: false },
      mappings: { key: "import.importProfile.mappings" },
      saveMappings: { key: "import.importProfile.saveMappings" },
      update: { key: "import.importProfile.update", idParam: "profileId" },
    },
  },
  incoterm: {
    module: "masterdata",
    ops: {
      archive: { key: "masterdata.incoterm.archive", idParam: "id" },
      create: { key: "masterdata.incoterm.create" },
      get: { key: "masterdata.incoterm.get", idParam: "id" },
      list: { key: "masterdata.incoterm.list", filtersWrapped: true },
      update: { key: "masterdata.incoterm.update", idParam: "id" },
    },
  },
  industry: {
    module: "masterdata",
    ops: {
      archive: { key: "masterdata.industry.archive", idParam: "id" },
      create: { key: "masterdata.industry.create" },
      get: { key: "masterdata.industry.get", idParam: "id" },
      list: { key: "masterdata.industry.list", filtersWrapped: true },
      update: { key: "masterdata.industry.update", idParam: "id" },
    },
  },
  inventoryBalance: {
    module: "logistics",
    ops: {
      create: { key: "logistics.inventoryBalance.create" },
      get: { key: "logistics.inventoryBalance.get", idParam: "id" },
      list: { key: "logistics.inventoryBalance.list", filtersWrapped: true },
      update: { key: "logistics.inventoryBalance.update", idParam: "id" },
    },
  },
  inventoryItem: {
    module: "logistics",
    ops: {
      create: { key: "logistics.inventoryItem.create" },
      get: { key: "logistics.inventoryItem.get", idParam: "id" },
      list: { key: "logistics.inventoryItem.list", filtersWrapped: true },
      update: { key: "logistics.inventoryItem.update", idParam: "id" },
    },
  },
  inventoryMovement: {
    module: "logistics",
    ops: {
      get: { key: "logistics.inventoryMovement.get", idParam: "id" },
      list: { key: "logistics.inventoryMovement.list", filtersWrapped: true },
    },
  },
  journalEntry: {
    module: "accounting",
    ops: {
      create: { key: "accounting.journalEntry.create" },
      get: { key: "accounting.journalEntry.get", idParam: "id" },
      list: { key: "accounting.journalEntry.list", filtersWrapped: true },
      update: { key: "accounting.journalEntry.update", idParam: "id" },
    },
  },
  journalLine: {
    module: "accounting",
    ops: {
      create: { key: "accounting.journalLine.create" },
      get: { key: "accounting.journalLine.get", idParam: "id" },
      list: { key: "accounting.journalLine.list", filtersWrapped: true },
      update: { key: "accounting.journalLine.update", idParam: "id" },
    },
  },
  modules: {
    module: "system",
    ops: {
      create: { key: "system.modules.create" },
      get: { key: "system.modules.get", idParam: "id" },
      list: { key: "system.modules.list", filtersWrapped: true },
      update: { key: "system.modules.update", idParam: "id" },
    },
  },
  numberSequence: {
    module: "masterdata",
    ops: {
      archive: { key: "masterdata.numberSequence.archive", idParam: "id" },
      create: { key: "masterdata.numberSequence.create" },
      get: { key: "masterdata.numberSequence.get", idParam: "id" },
      list: { key: "masterdata.numberSequence.list", filtersWrapped: true },
      update: { key: "masterdata.numberSequence.update", idParam: "id" },
    },
  },
  organization: {
    module: "system",
    ops: {
      archive: { key: "system.organization.archive", idParam: "id" },
      create: { key: "system.organization.create" },
      get: { key: "system.organization.get", idParam: "id" },
      list: { key: "system.organization.list", filtersWrapped: true },
      update: { key: "system.organization.update", idParam: "id" },
    },
  },
  paymentTerm: {
    module: "masterdata",
    ops: {
      archive: { key: "masterdata.paymentTerm.archive", idParam: "paymentTermId" },
      create: { key: "masterdata.paymentTerm.create" },
      get: { key: "masterdata.paymentTerm.get", idParam: "paymentTermId" },
      list: { key: "masterdata.paymentTerm.list", filtersWrapped: false },
      update: { key: "masterdata.paymentTerm.update", idParam: "paymentTermId" },
    },
  },
  postalCode: {
    module: "masterdata",
    ops: {
      archive: { key: "masterdata.postalCode.archive", idParam: "id" },
      create: { key: "masterdata.postalCode.create" },
      get: { key: "masterdata.postalCode.get", idParam: "id" },
      list: { key: "masterdata.postalCode.list", filtersWrapped: true },
      update: { key: "masterdata.postalCode.update", idParam: "id" },
    },
  },
  priceList: {
    module: "masterdata",
    ops: {
      archive: { key: "masterdata.priceList.archive", idParam: "priceListId" },
      create: { key: "masterdata.priceList.create" },
      get: { key: "masterdata.priceList.get", idParam: "priceListId" },
      list: { key: "masterdata.priceList.list", filtersWrapped: false },
      update: { key: "masterdata.priceList.update", idParam: "priceListId" },
      upsert: { key: "masterdata.priceList.upsert" },
    },
  },
  priceListItem: {
    module: "masterdata",
    ops: {
      create: { key: "masterdata.priceListItem.create" },
      get: { key: "masterdata.priceListItem.get", idParam: "id" },
      list: { key: "masterdata.priceListItem.list", filtersWrapped: true },
      update: { key: "masterdata.priceListItem.update", idParam: "id" },
    },
  },
  productionOrder: {
    module: "masterdata",
    ops: {
      archive: { key: "masterdata.productionOrder.archive", idParam: "id" },
      create: { key: "masterdata.productionOrder.create" },
      get: { key: "masterdata.productionOrder.get", idParam: "id" },
      list: { key: "masterdata.productionOrder.list", filtersWrapped: true },
      update: { key: "masterdata.productionOrder.update", idParam: "id" },
    },
  },
  registry: {
    module: "system",
    ops: {
      discoverEntities: { key: "system.registry.discoverEntities" },
      explainConstraint: { key: "system.registry.explainConstraint" },
      generateFixture: { key: "system.registry.generateFixture" },
      resolveProjection: { key: "system.registry.resolveProjection" },
      validatePayload: { key: "system.registry.validatePayload" },
    },
  },
  salesChannel: {
    module: "commerce",
    ops: {
      archive: { key: "commerce.salesChannel.archive", idParam: "salesChannelId" },
      create: { key: "commerce.salesChannel.create" },
      get: { key: "commerce.salesChannel.get", idParam: "salesChannelId" },
      list: { key: "commerce.salesChannel.list", filtersWrapped: false },
      testConnection: { key: "commerce.salesChannel.testConnection" },
      update: { key: "commerce.salesChannel.update", idParam: "salesChannelId" },
    },
  },
  serialNumber: {
    module: "logistics",
    ops: {
      create: { key: "logistics.serialNumber.create" },
      get: { key: "logistics.serialNumber.get", idParam: "id" },
      list: { key: "logistics.serialNumber.list", filtersWrapped: true },
      update: { key: "logistics.serialNumber.update", idParam: "id" },
    },
  },
  shippingMethod: {
    module: "masterdata",
    ops: {
      archive: { key: "masterdata.shippingMethod.archive", idParam: "id" },
      create: { key: "masterdata.shippingMethod.create" },
      get: { key: "masterdata.shippingMethod.get", idParam: "id" },
      list: { key: "masterdata.shippingMethod.list", filtersWrapped: true },
      update: { key: "masterdata.shippingMethod.update", idParam: "id" },
    },
  },
  systemSettings: {
    module: "system",
    ops: {
      create: { key: "system.systemSettings.create" },
      get: { key: "system.systemSettings.get", idParam: "id" },
      list: { key: "system.systemSettings.list", filtersWrapped: true },
      update: { key: "system.systemSettings.update", idParam: "id" },
    },
  },
  taxClass: {
    module: "masterdata",
    ops: {
      archive: { key: "masterdata.taxClass.archive", idParam: "id" },
      create: { key: "masterdata.taxClass.create" },
      get: { key: "masterdata.taxClass.get", idParam: "id" },
      list: { key: "masterdata.taxClass.list", filtersWrapped: true },
      update: { key: "masterdata.taxClass.update", idParam: "id" },
    },
  },
  taxCode: {
    module: "masterdata",
    ops: {
      archive: { key: "masterdata.taxCode.archive", idParam: "id" },
      create: { key: "masterdata.taxCode.create" },
      get: { key: "masterdata.taxCode.get", idParam: "id" },
      list: { key: "masterdata.taxCode.list", filtersWrapped: true },
      update: { key: "masterdata.taxCode.update", idParam: "id" },
    },
  },
  taxRule: {
    module: "masterdata",
    ops: {
      create: { key: "masterdata.taxRule.create" },
      get: { key: "masterdata.taxRule.get", idParam: "id" },
      list: { key: "masterdata.taxRule.list", filtersWrapped: true },
      update: { key: "masterdata.taxRule.update", idParam: "id" },
    },
  },
  tenant: {
    module: "system",
    ops: {
      archive: { key: "system.tenant.archive", idParam: "id" },
      create: { key: "system.tenant.create" },
      get: { key: "system.tenant.get", idParam: "id" },
      list: { key: "system.tenant.list", filtersWrapped: true },
      update: { key: "system.tenant.update", idParam: "id" },
    },
  },
  tenantConnector: {
    module: "system",
    ops: {
      archive: { key: "system.tenantConnector.archive", idParam: "id" },
      create: { key: "system.tenantConnector.create" },
      get: { key: "system.tenantConnector.get", idParam: "id" },
      list: { key: "system.tenantConnector.list", filtersWrapped: true },
      update: { key: "system.tenantConnector.update", idParam: "id" },
    },
  },
  tenantConnectorMapping: {
    module: "system",
    ops: {
      create: { key: "system.tenantConnectorMapping.create" },
      get: { key: "system.tenantConnectorMapping.get", idParam: "id" },
      list: { key: "system.tenantConnectorMapping.list", filtersWrapped: true },
      update: { key: "system.tenantConnectorMapping.update", idParam: "id" },
    },
  },
  tenantFields: {
    module: "system",
    ops: {
      archive: { key: "system.tenantFields.archive", idParam: "id" },
      create: { key: "system.tenantFields.create" },
      get: { key: "system.tenantFields.get", idParam: "id" },
      list: { key: "system.tenantFields.list", filtersWrapped: true },
      update: { key: "system.tenantFields.update", idParam: "id" },
    },
  },
  tenantGroups: {
    module: "system",
    ops: {
      create: { key: "system.tenantGroups.create" },
      get: { key: "system.tenantGroups.get", idParam: "id" },
      list: { key: "system.tenantGroups.list", filtersWrapped: true },
      update: { key: "system.tenantGroups.update", idParam: "id" },
    },
  },
  tenantLayouts: {
    module: "system",
    ops: {
      create: { key: "system.tenantLayouts.create" },
      get: { key: "system.tenantLayouts.get", idParam: "id" },
      list: { key: "system.tenantLayouts.list", filtersWrapped: true },
      update: { key: "system.tenantLayouts.update", idParam: "id" },
    },
  },
  tenantLlmConfig: {
    module: "system",
    ops: {
      create: { key: "system.tenantLlmConfig.create" },
      get: { key: "system.tenantLlmConfig.get", idParam: "id" },
      list: { key: "system.tenantLlmConfig.list", filtersWrapped: true },
      update: { key: "system.tenantLlmConfig.update", idParam: "id" },
    },
  },
  tenantRules: {
    module: "system",
    ops: {
      create: { key: "system.tenantRules.create" },
      get: { key: "system.tenantRules.get", idParam: "id" },
      list: { key: "system.tenantRules.list", filtersWrapped: true },
      update: { key: "system.tenantRules.update", idParam: "id" },
    },
  },
  unit: {
    module: "masterdata",
    ops: {
      archive: { key: "masterdata.unit.archive", idParam: "unitId" },
      create: { key: "masterdata.unit.create" },
      get: { key: "masterdata.unit.get", idParam: "unitId" },
      list: { key: "masterdata.unit.list", filtersWrapped: false },
      update: { key: "masterdata.unit.update", idParam: "unitId" },
      upsert: { key: "masterdata.unit.upsert" },
    },
  },
  userTenant: {
    module: "system",
    ops: {
      create: { key: "system.userTenant.create" },
      get: { key: "system.userTenant.get", idParam: "id" },
      list: { key: "system.userTenant.list", filtersWrapped: true },
      update: { key: "system.userTenant.update", idParam: "id" },
    },
  },
  warehouse: {
    module: "masterdata",
    ops: {
      archive: { key: "masterdata.warehouse.archive", idParam: "id" },
      create: { key: "masterdata.warehouse.create" },
      get: { key: "masterdata.warehouse.get", idParam: "id" },
      list: { key: "masterdata.warehouse.list", filtersWrapped: true },
      update: { key: "masterdata.warehouse.update", idParam: "id" },
    },
  },
};
