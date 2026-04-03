export enum Foil {
  None = 0,
  NoFoil = 1 << 0,
  Foil = 1 << 1,
  Any = NoFoil | Foil,
}

export enum PrintingTraits {
  None = 0,
  Standard = 1 << 0,
  AlternateArt = 1 << 1,
  Overnumbered = 1 << 2,
  Signature = 1 << 3,
  Metal = 1 << 4,
  Starter = 1 << 5,
  LaunchExclusive = 1 << 6,
  GGEZ = 1 << 7,
  // TODO - tf we do with recruit special tags
  _271 = 1 << 8,
  _272 = 1 << 9,
  _273 = 1 << 10,
  _274 = 1 << 11,
}

export enum TradeDirection {
  Buy = 0,
  Sell = 1,
}
