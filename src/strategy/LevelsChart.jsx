
import React, { useEffect, useRef, useState } from "react";
import {
  createChart,
  CandlestickSeries,
  LineStyle
} from "lightweight-charts";

export default function LevelsChart({
  instrument = "NIFTY 50",
  levels = [],
  manualLevels = []
}) {
  const containerRef = useRef(null);
  const chartRef = useRef(null);
  const candleSeriesRef = useRef(null);

  const [chartStatus, setChartStatus] = useState("Loading market data...");

  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      width: containerRef.current.clientWidth,
      height: 380,
      layout: {
        background: { color: "#080e19" },
        textColor: "#aab7ca"
      },
      grid: {
        vertLines: { color: "#172235" },
        horzLines: { color: "#172235" }
      },
      rightPriceScale: {
        borderColor: "#253248"
      },
      timeScale: {
        borderColor: "#253248",
        timeVisible: true,
        secondsVisible: false
      },
      crosshair: {
        mode: 0
      }
    });

    const candles = chart.addSeries(CandlestickSeries, {
      upColor: "#19d69b",
      downColor: "#ff6477",
      borderUpColor: "#19d69b",
      borderDownColor: "#ff6477",
      wickUpColor: "#19d69b",
      wickDownColor: "#ff6477"
    });

    chartRef.current = chart;
    candleSeriesRef.current = candles;

    const resizeObserver = new ResizeObserver(() => {
      if (containerRef.current) {
        chart.applyOptions({
          width: containerRef.current.clientWidth
        });
      }
    });

    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
      chart.remove();
      chartRef.current = null;
      candleSeriesRef.current = null;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadCandles() {
      setChartStatus("Loading market data...");

      try {
        const symbol = encodeURIComponent(instrument);
        const url =
          `https://retail-bloomberg-2.onrender.com/api/v1/market/candles?symbol=${symbol}&interval=ONE_MINUTE&days=5`;

        const response = await fetch(url);

        if (!response.ok) {
          throw new Error(`Market data error: ${response.status}`);
        }

        const result = await response.json();
        const rows = result.candles || result.data || [];

        const data = rows
          .map((item) => ({
            time: typeof item.time === "number"
              ? Math.floor(item.time > 100000000000 ? item.time / 1000 : item.time)
              : Math.floor(new Date(item.time).getTime() / 1000),
            open: Number(item.open),
            high: Number(item.high),
            low: Number(item.low),
            close: Number(item.close)
          }))
          .filter((item) =>
            Number.isFinite(item.time) &&
            Number.isFinite(item.open) &&
            Number.isFinite(item.high) &&
            Number.isFinite(item.low) &&
            Number.isFinite(item.close)
          )
          .sort((a, b) => a.time - b.time);

        if (cancelled) return;
        if (!data.length) throw new Error("No candle data received.");

        candleSeriesRef.current.setData(data);
        chartRef.current.timeScale().fitContent();
        setChartStatus(`${data.length} candles loaded`);
      } catch (error) {
        if (!cancelled) {
          setChartStatus(error.message);
        }
      }
    }

    loadCandles();

    return () => {
      cancelled = true;
    };
  }, [instrument]);

  useEffect(() => {
    const series = candleSeriesRef.current;
    if (!series) return;

    const allLevels = [...levels, ...manualLevels];
    const priceLines = [];

    allLevels.forEach((item) => {
      const price = Number(item.price);
      if (!Number.isFinite(price) || price <= 0) return;

      const lineStyle =
        item.style === "dashed"
          ? LineStyle.Dashed
          : item.style === "dotted"
            ? LineStyle.Dotted
            : LineStyle.Solid;

      const line = series.createPriceLine({
        price,
        color: item.color || "#5795ff",
        lineWidth: item.highlighted ? 3 : 2,
        lineStyle,
        axisLabelVisible: true,
        title: item.shortName || item.name || "Level"
      });

      priceLines.push(line);
    });

    return () => {
      priceLines.forEach((line) => {
        series.removePriceLine(line);
      });
    };
  }, [levels, manualLevels]);

  return (
    <div style={{ width: "100%" }}>
      <div
        style={{
          color: "#8290a5",
          fontSize: 12,
          marginBottom: 8
        }}
      >
        {instrument} · {chartStatus}
      </div>

      <div
        ref={containerRef}
        style={{
          width: "100%",
          minHeight: 380,
          border: "1px solid #253248",
          borderRadius: 9,
          overflow: "hidden"
        }}
      />
    </div>
  );
}
