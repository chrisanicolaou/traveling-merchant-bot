export interface CardDataProvider {
  getCardNames(): Promise<string[]>;
  // TODO - create domain object for card data. Decide what I actually want from underlying APIs
  getCardByName(cardName: string): Promise<any>;
}
