export interface ExchangeRateProvider {
  getRate(from: string, to: string): Promise<number>;
}
