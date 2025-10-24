export interface IWbTariffItem {
  // WB box-specific fields (strings as they come from API, often using comma as decimal separator)
  boxDeliveryBase?: string;
  boxDeliveryCoefExpr?: string; // e.g. "160"
  boxDeliveryLiter?: string; // e.g. "11,2"
  boxDeliveryMarketplaceBase?: string;
  boxDeliveryMarketplaceCoefExpr?: string;
  boxDeliveryMarketplaceLiter?: string;
  boxStorageBase?: string;
  boxStorageCoefExpr?: string;
  boxStorageLiter?: string;
  geoName?: string;
  warehouseName?: string;
}
