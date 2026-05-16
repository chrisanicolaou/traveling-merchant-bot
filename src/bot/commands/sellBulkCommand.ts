import { MODAL_CUSTOM_ID_PREFIX, TradeBulkCommand } from "./tradeBulkCommand";
import { CommandName } from "../constants";
import { TradeDirection } from "../../shared/enums";
import type { Services } from "../../shared/types/services";

export class SellBulkCommand extends TradeBulkCommand {
  protected readonly direction = TradeDirection.Sell;
  protected readonly modalCustomId = `${MODAL_CUSTOM_ID_PREFIX}:sell`;

  constructor(services: Services) {
    super(services, CommandName.SELLBULK, "Bulk-add cards you'd like to sell from a pasted list");
  }
}
