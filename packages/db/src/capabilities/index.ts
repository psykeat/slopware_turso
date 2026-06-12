import { registerCapabilities } from "./core/registry";
import { articleCapabilities } from "./modules/masterdata.article";
import { articleBomCapabilities } from "./modules/masterdata.article-bom";
import { articleCategoryCapabilities } from "./modules/masterdata.article-category";
import { articleImageCapabilities } from "./modules/masterdata.article-image";
import { articleMediaCapabilities } from "./modules/masterdata.article-media";
import { articleOptionCapabilities } from "./modules/masterdata.article-option";
import { articleOptionValueCapabilities } from "./modules/masterdata.article-option-value";
import { articleVariantCapabilities } from "./modules/masterdata.article-variant";
import { articleVariantOptionValueCapabilities } from "./modules/masterdata.article-variant-option-value";
import { addressCapabilities } from "./modules/masterdata.address";
import { articleGroupCapabilities } from "./modules/masterdata.article-group";
import { countryCapabilities } from "./modules/masterdata.country";
import { currencyCapabilities } from "./modules/masterdata.currency";
import { categoryCapabilities } from "./modules/masterdata.category";
import { deliveryAddressCapabilities } from "./modules/masterdata.delivery-address";
import { variantTemplateCapabilities } from "./modules/masterdata.variant-template";
import { paymentTermCapabilities } from "./modules/masterdata.payment-term";
import { priceListCapabilities } from "./modules/masterdata.price-list";
import { accountingCapabilities } from "./modules/accounting.core";
import { documentLineCapabilities } from "./modules/sales.document-line";
import { documentCapabilities } from "./modules/sales.document";
import { logisticsCapabilities } from "./modules/logistics.core";
import { systemCapabilities } from "./modules/system.core";
import { masterdataRemainingCapabilities } from "./modules/masterdata.remaining";
import { unitCapabilities } from "./modules/masterdata.unit";

// Static registration: a capability exists exactly when its module is imported
// here, so the registry can never drift from the code.
registerCapabilities(
  ...articleCapabilities,
  ...articleBomCapabilities,
  ...articleCategoryCapabilities,
  ...articleImageCapabilities,
  ...articleMediaCapabilities,
  ...articleOptionCapabilities,
  ...articleOptionValueCapabilities,
  ...articleVariantCapabilities,
  ...articleVariantOptionValueCapabilities,
  ...addressCapabilities,
  ...articleGroupCapabilities,
  ...categoryCapabilities,
  ...countryCapabilities,
  ...currencyCapabilities,
  ...deliveryAddressCapabilities,
  ...variantTemplateCapabilities,
  ...paymentTermCapabilities,
  ...priceListCapabilities,
  ...accountingCapabilities,
  ...documentLineCapabilities,
  ...documentCapabilities,
  ...logisticsCapabilities,
  ...systemCapabilities,
  ...masterdataRemainingCapabilities,
  ...unitCapabilities,
);

export { executeCapability } from "./core/execute";
export { getCapability, listCapabilities } from "./core/registry";
export { defineCapability } from "./core/define";
export {
  capabilityDescriptor,
  capabilityInputJsonSchema,
  capabilityOutputJsonSchema,
} from "./core/json-schema";
export { CapabilityError, toCapabilityRole } from "./core/types";
export type {
  ActorMode,
  AnyCapability,
  CapabilityDefinition,
  CapabilityErrorCode,
  CapabilityIssue,
  CapabilityKind,
  CapabilityModule,
  CapabilityResult,
  CapabilityRole,
  ExecutionContext,
  LlmExposure,
} from "./core/types";
