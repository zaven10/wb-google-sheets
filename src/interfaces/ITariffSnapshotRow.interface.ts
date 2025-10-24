import { IWbTariffItem } from "./IWbTariffItem.interface.js";

export interface ITariffSnapshotRow {
  day: string;
  data: IWbTariffItem[];
  updated_at: string;
}
