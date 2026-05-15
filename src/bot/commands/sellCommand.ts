import { TradeCommand } from "./tradeCommand";
import { CommandName } from "../constants";
import { TradeDirection } from "../../shared/enums";
import type { Services } from "../../shared/types/services";

export class SellCommand extends TradeCommand {
  protected readonly direction = TradeDirection.Sell;

  constructor(services: Services) {
    super(services, CommandName.SELL, "Add a card you'd like to sell");
  }
}
