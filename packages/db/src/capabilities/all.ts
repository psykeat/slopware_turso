import { accountingCapabilities } from "./modules/accounting.core";
import { communicationEmailCapabilities } from "./modules/communication.email";
import { importCapabilities } from "./modules/import.core";
import { logisticsCapabilities } from "./modules/logistics.core";
import { addressCapabilities } from "./modules/masterdata.address";
import { articleCapabilities } from "./modules/masterdata.article";
import { articleBomCapabilities } from "./modules/masterdata.article-bom";
import { articleCategoryCapabilities } from "./modules/masterdata.article-category";
import { articleGroupCapabilities } from "./modules/masterdata.article-group";
import { articleImageCapabilities } from "./modules/masterdata.article-image";
import { articleMediaCapabilities } from "./modules/masterdata.article-media";
import { articleOptionCapabilities } from "./modules/masterdata.article-option";
import { articleOptionValueCapabilities } from "./modules/masterdata.article-option-value";
import { articleVariantCapabilities } from "./modules/masterdata.article-variant";
import { articleVariantOptionValueCapabilities } from "./modules/masterdata.article-variant-option-value";
import { categoryCapabilities } from "./modules/masterdata.category";
import { countryCapabilities } from "./modules/masterdata.country";
import { currencyCapabilities } from "./modules/masterdata.currency";
import { deliveryAddressCapabilities } from "./modules/masterdata.delivery-address";
import { paymentTermCapabilities } from "./modules/masterdata.payment-term";
import { priceListCapabilities } from "./modules/masterdata.price-list";
import { masterdataRemainingCapabilities } from "./modules/masterdata.remaining";
import { unitCapabilities } from "./modules/masterdata.unit";
import { variantTemplateCapabilities } from "./modules/masterdata.variant-template";
import { documentCapabilities } from "./modules/sales.document";
import { documentLineCapabilities } from "./modules/sales.document-line";
import { systemCapabilities } from "./modules/system.core";

// Single aggregation point for every capability module. index.ts registers
// from here; type-map.ts derives the literal-key index type from here. Kept
// out of index.ts so type-map.ts can import it without a module cycle.
export const allCapabilities = [
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
  ...communicationEmailCapabilities,
  ...importCapabilities,
  ...documentLineCapabilities,
  ...documentCapabilities,
  ...logisticsCapabilities,
  ...systemCapabilities,
  ...masterdataRemainingCapabilities,
  ...unitCapabilities,
];
