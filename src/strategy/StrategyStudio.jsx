import React, { useState } from "react";

export default function StrategyStudio() {
  const [tab, setTab] = useState("editor");
  const [script, setScript] = useState(`// Pulse Strategy Script

indicator("My First Strategy")

emaFast = ema(close, 9)
emaSlow = ema(close, 21)
vwapLine = vwap()

buySignal = crossover(emaFast, emaSlow)
sellSignal = crossunder(emaFast, emaSlow)

plot(emaFast, "EMA 9")
plot(emaSlow, "EMA 21")

plotshape(buySignal, "BUY")
plotshape(sellSignal, "SELL")`);
  const [status, setStatus] = useState("Ready");
  const [activeTool, setActiveTool] = useState("Indicators");
  const [levelInstrument, setLevelInstrument] = useState("NIFTY 50");

const [previousOHLC, setPreviousOHLC] = useState({
  open: "",
  high: "",
  low: "",
  close: ""
});

const [manualLevels, setManualLevels] = useState([]);

const [levelName, setLevelName] = useState("");
const [levelPrice, setLevelPrice] = useState("");
const [levelColor, setLevelColor] = useState("#19d69b");
const [levelStyle, setLevelStyle] = useState("solid");

const [calculatedLevels, setCalculatedLevels] = useState([]);
const [levelStatus, setLevelStatus] = useState("Waiting for previous-day data");

   const calculateAutoLevels = () => {
    const O = Number(previousOHLC.open);
    const H = Number(previousOHLC.high);
    const L = Number(previousOHLC.low);
    const C = Number(previousOHLC.close);

    if (
      !Number.isFinite(O) ||
      !Number.isFinite(H) ||
      !Number.isFinite(L) ||
      !Number.isFinite(C) ||
      !previousOHLC.open ||
      !previousOHLC.high ||
      !previousOHLC.low ||
      !previousOHLC.close ||
      H <= L ||
      H < Math.max(O, C) ||
      L > Math.min(O, C)
    ) {
      setLevelStatus("Invalid OHLC values. Please check your inputs.");
      setCalculatedLevels([]);
      return;
    }

    const P = (H + L + C) / 3;

    const levels = [
      { name: "Pivot Point", price: P, color: "#f5c451" },
      { name: "R1", price: 2 * P - L, color: "#19d69b" },
      { name: "R2", price: P + (H - L), color: "#19d69b" },
      { name: "R3", price: H + 2 * (P - L), color: "#19d69b" },
      { name: "S1", price: 2 * P - H, color: "#ff6477" },
      { name: "S2", price: P - (H - L), color: "#ff6477" },
      { name: "S3", price: L - 2 * (H - P), color: "#ff6477" }
    ];

    setCalculatedLevels(levels);
    setLevelStatus("7 automatic levels calculated successfully");
  }; const colors = {
    bg: "#080d16",
    panel: "#101827",
    border: "#253248",
    text: "#e8eef8",
    muted: "#8290a5",
    green: "#19d69b",
    blue: "#5795ff",
    red: "#ff6477"
  };

  const card = {
    background: colors.panel,
    border: `1px solid ${colors.border}`,
    borderRadius: 12,
    padding: 16
  };

  const tabStyle = (active) => ({
    padding: "10px 16px",
    borderRadius: 8,
    border: "1px solid " + (active ? colors.blue : colors.border),
    background: active ? "#1b3150" : "transparent",
    color: active ? "#8ebaff" : colors.muted,
    cursor: "pointer",
    fontWeight: 600
  });

  const runStrategy = () => {
    setStatus("Script saved for engine integration");
  };

  return (
    <div style={{
      background: colors.bg,
      color: colors.text,
      minHeight: "100vh",
      padding: 20,
      fontFamily: "Inter, Arial, sans-serif"
    }}>
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        flexWrap: "wrap",
        gap: 12,
        marginBottom: 22
      }}>
        <div>
          <div style={{color: colors.blue, fontSize: 12, fontWeight: 700}}>
            PULSE TERMINAL / QUANT LAB
          </div>
          <h1 style={{fontSize: 25, margin: "7px 0"}}>
            Strategy Studio
          </h1>
          <div style={{color: colors.muted, fontSize: 13}}>
            Build custom indicators, trading signals and market levels.
          </div>
        </div>
        <div style={{
          background: "#12352f",
          color: colors.green,
          borderRadius: 20,
          padding: "8px 13px",
          fontSize: 12
        }}>
          ● Strategy Workspace
        </div>
      </div>

      <div style={{
        display: "flex",
        flexWrap: "wrap",
        gap: 9,
        marginBottom: 18
      }}>
        <button style={tabStyle(tab === "editor")} onClick={() => setTab("editor")}>
          Code Editor
        </button>
        <button style={tabStyle(tab === "builder")} onClick={() => setTab("builder")}>
          Visual Builder
        </button>
        <button style={tabStyle(tab === "levels")} onClick={() => setTab("levels")}>
          Daily Levels
        </button>
        <button style={tabStyle(tab === "signals")} onClick={() => setTab("signals")}>
          Signal Settings
        </button>
      </div>

      {tab === "editor" && (
        <div style={{...card, marginBottom: 16}}>
          <div style={{
            display: "flex",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 10,
            marginBottom: 14
          }}>
            <div>
              <b>Strategy Editor</b>
              <div style={{fontSize: 12, color: colors.muted, marginTop: 5}}>
                Write or paste your custom strategy script
              </div>
            </div>
            <button onClick={runStrategy} style={{
              background: colors.green,
              color: "#04130f",
              border: 0,
              borderRadius: 8,
              padding: "10px 20px",
              fontWeight: 800,
              cursor: "pointer"
            }}>
              ▶ Run Strategy
            </button>
          </div>
          <textarea
            value={script}
            onChange={(e) => setScript(e.target.value)}
            spellCheck={false}
            style={{
              width: "100%",
              minHeight: 330,
              boxSizing: "border-box",
              resize: "vertical",
              background: "#080e19",
              color: "#b8d6ff",
              border: `1px solid ${colors.border}`,
              borderRadius: 9,
              padding: 16,
              fontFamily: "monospace",
              fontSize: 14,
              lineHeight: 1.8,
              outline: "none"
            }}
          />
          <div style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 10,
            flexWrap: "wrap",
            marginTop: 12,
            color: colors.muted,
            fontSize: 12
          }}>
            <span>Pulse Script · Draft</span>
            <span>{script.split("\n").length} lines</span>
          </div>
        </div>
      )}

      {tab === "builder" && (
        <div style={card}>
          <h3>Visual Strategy Builder</h3>
          <p style={{color: colors.muted, fontSize: 13}}>
            Configure conditions without writing code.
          </p>
          <div style={{display: "flex", gap: 9, flexWrap: "wrap"}}>
            {["Indicators", "Price Action", "Volume", "Momentum"].map(item => (
              <button key={item} onClick={() => setActiveTool(item)}
                style={tabStyle(activeTool === item)}>
                {item}
              </button>
            ))}
          </div>
          <div style={{
            marginTop: 18,
            padding: 18,
            background: "#080e19",
            borderRadius: 9,
            border: `1px solid ${colors.border}`
          }}>
            <b>{activeTool}</b>
            <p style={{color: colors.muted, fontSize: 13}}>
              Indicator and condition configuration will be added in the next stage.
            </p>
            <div style={{color: colors.green, fontSize: 13}}>
              + Add condition
            </div>
          </div>
        </div>
      )}

      {tab === "levels" && (
        <div style={card}>
          <h3>Daily Automatic Levels</h3>
          <p style={{color: colors.muted, fontSize: 13}}>
            Configure levels calculated after each completed trading session.
          </p>
          {["Daily Pivot", "DR1 / RXL", "Important Level", "Buy Above", "Sell Below", "Yesterday High", "Yesterday Low"].map(item => (
            <div key={item} style={{
              display: "flex",
              justifyContent: "space-between",
              padding: "13px 4px",
              borderBottom: `1px solid ${colors.border}`
            }}>
              <span>{item}</span>
              <span style={{color: colors.green, fontSize: 12}}>● Enabled</span>
            </div>
          ))}
          <p style={{fontSize: 12, color: colors.muted}}>
            Formula configuration and automatic daily calculations are not connected yet.
          </p>
        </div>
      )}

      {tab === "signals" && (
        <div style={card}>
          <h3>Signal Configuration</h3>
          <p style={{color: colors.muted, fontSize: 13}}>
            Choose the data categories for your strategy.
          </p>
          {["Price Action", "EMA / SMA", "VWAP", "Volume Analysis", "RSI / Momentum", "Support & Resistance"].map(item => (
            <div key={item} style={{
              padding: 13,
              borderBottom: `1px solid ${colors.border}`,
              display: "flex",
              justifyContent: "space-between"
            }}>
              {item}
              <span style={{color: colors.green}}>Available for configuration</span>
            </div>
          ))}
        </div>
      )}

      <div style={{
        ...card,
        marginTop: 16
      }}>
        <div style={{display: "flex", justifyContent: "space-between", gap: 10}}>
          <b>Chart Preview</b>
          <span style={{fontSize: 12, color: colors.muted}}>NIFTY 50 · Preview</span>
        </div>
        <div style={{
          height: 180,
          marginTop: 14,
          background: "#080e19",
          border: `1px solid ${colors.border}`,
          borderRadius: 9,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: colors.muted,
          textAlign: "center",
          padding: 15,
          fontSize: 13
        }}>
          Live chart and indicator plotting integration will be added next.
        </div>
      </div>

      <div style={{
        ...card,
        marginTop: 16,
        display: "flex",
        justifyContent: "space-between",
        flexWrap: "wrap",
        gap: 10,
        fontSize: 12
      }}>
        <span style={{color: colors.muted}}>Engine Status</span>
        <span style={{color: colors.green}}>{status}</span>
      </div>

      <p style={{
        color: colors.muted,
        fontSize: 11,
        marginTop: 18,
        textAlign: "center"
      }}>
        PULSE STRATEGY STUDIO · FOUNDATION BUILD
      </p>
    </div>
  );
}

