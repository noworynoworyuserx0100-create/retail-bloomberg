
const LEVEL_INTERVAL = 100;

const INSTRUMENT_CONFIG = {
  "NIFTY 50": {
    upsideCount: 4,
    downsideCount: 4,
    interval: 100,
  },
  BANKNIFTY: {
    upsideCount: 10,
    downsideCount: 10,
    interval: 100,
  },
};

function validateOHLC({ open, high, low, close }) {
  const values = [open, high, low, close].map(Number);

  if (!values.every(Number.isFinite)) {
    throw new Error("OHLC values must be valid numbers.");
  }

  const [O, H, L, C] = values;

  if (
    values.some((value) => value <= 0) ||
    H <= L ||
    H < Math.max(O, C) ||
    L > Math.min(O, C)
  ) {
    throw new Error("Invalid OHLC values.");
  }

  return { open: O, high: H, low: L, close: C };
}

function generateRoundFigureLevels(instrument, closingPrice) {
  const config = INSTRUMENT_CONFIG[instrument];

  if (!config) {
    throw new Error("Unsupported instrument.");
  }

  const close = Number(closingPrice);

  if (!Number.isFinite(close) || close <= 0) {
    throw new Error("Invalid closing price.");
  }

  const { interval, upsideCount, downsideCount } = config;

  // Exact round figure is included on the upside.
  const firstUpside =
    Math.ceil(close / interval) * interval;

  // Downside starts strictly below the closing price.
  const firstDownside = firstUpside - interval;

  const upside = Array.from(
    { length: upsideCount },
    (_, index) => {
      const price = firstUpside + index * interval;

      return {
        id: `${instrument}-UP-${price}`,
        name: `ROUND ${price}`,
        price,
        direction: "upside",
        type: "round-figure",
        highlighted:
          instrument === "BANKNIFTY" && price % 500 === 0,
      };
    }
  );

  const downside = Array.from(
    { length: downsideCount },
    (_, index) => {
      const price = firstDownside - index * interval;

      return {
        id: `${instrument}-DOWN-${price}`,
        name: `ROUND ${price}`,
        price,
        direction: "downside",
        type: "round-figure",
        highlighted:
          instrument === "BANKNIFTY" && price % 500 === 0,
      };
    }
  );

  return [...upside, ...downside];
}

export function generateDailyLevels(instrument, previousOHLC) {
  const ohlc = validateOHLC(previousOHLC);

  const previousDayLevels = [
    {
      id: `${instrument}-YST-HIGH`,
      name: "YST HIGH",
      price: ohlc.high,
      type: "previous-day",
      direction: "high",
      highlighted: false,
    },
    {
      id: `${instrument}-YST-LOW`,
      name: "YST LOW",
      price: ohlc.low,
      type: "previous-day",
      direction: "low",
      highlighted: false,
    },
  ];

  const roundFigureLevels = generateRoundFigureLevels(
    instrument,
    ohlc.close
  );

  return {
    instrument,
    referenceClose: ohlc.close,
    levels: [...previousDayLevels, ...roundFigureLevels],
    generatedAt: new Date().toISOString(),
  };
}
