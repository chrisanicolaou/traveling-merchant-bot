import { MODAL_CUSTOM_ID_PREFIX, TradeBulkCommand } from "./tradeBulkCommand";
import { CommandName } from "../constants";
import { TradeDirection } from "../../shared/enums";
import type { Services } from "../../shared/types/services";

export class BuyBulkCommand extends TradeBulkCommand {
  protected readonly direction = TradeDirection.Buy;
  protected readonly modalCustomId = `${MODAL_CUSTOM_ID_PREFIX}:buy`;

  constructor(services: Services) {
    super(services, CommandName.BUYBULK, "Bulk-add cards you'd like to buy from a pasted list");
  }
}
