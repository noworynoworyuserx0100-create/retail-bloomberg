
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

  // DAILY LEVEL SETTINGS
  const [levelInstrument, setLevelInstrument] = useState("NIFTY 50");

  const [previousOHLC, setPreviousOHLC] = useState({
    open: "",
    high: "",
    low: "",
    close: ""
  });

  const [calculatedLevels, setCalculatedLevels] = useState([]);
  const [levelStatus, setLevelStatus] = useState(
    "Enter previous trading session OHLC"
  );

  const [manualLevels, setManualLevels] = useState([]);
  const [levelName, setLevelName] = useState("");
  const [levelPrice, setLevelPrice] = useState("");
  const [levelColor, setLevelColor] = useState("#19d69b");
  const [levelStyle, setLevelStyle] = useState("solid");

  const colors = {
    bg: "#080d16",
    panel: "#101827",
    border: "#253248",
    text: "#e8eef8",
    muted: "#8290a5",
    green: "#19d69b",
    blue: "#5795ff",
    red: "#ff6477",
    yellow: "#f5c451"
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
    border: `1px solid ${active ? colors.blue : colors.border}`,
    background: active ? "#1b3150" : "transparent",
    color: active ? "#8ebaff" : colors.muted,
    cursor: "pointer",
    fontWeight: 600
  });

  const inputStyle = {
    width: "100%",
    boxSizing: "border-box",
    padding: 12,
    background: "#080e19",
    color: colors.text,
    border: `1px solid ${colors.border}`,
    borderRadius: 8,
    outline: "none",
    fontSize: 14
  };

  const formatPrice = (value) =>
    Number(value).toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });

  const runStrategy = () => {
    setStatus("Script saved for engine integration");
  };

  // TRADITIONAL PIVOT CALCULATION
  const calculateAutoLevels = () => {
    const O = Number(previousOHLC.open);
    const H = Number(previousOHLC.high);
    const L = Number(previousOHLC.low);
    const C = Number(previousOHLC.close);

    const inputs = [
      previousOHLC.open,
      previousOHLC.high,
      previousOHLC.low,
      previousOHLC.close
    ];

    if (
      inputs.some((value) => value.trim() === "") ||
      ![O, H, L, C].every(Number.isFinite) ||
      O <= 0 ||
      H <= 0 ||
      L <= 0 ||
      C <= 0 ||
      H <= L ||
      H < Math.max(O, C) ||
      L > Math.min(O, C)
    ) {
      setCalculatedLevels([]);
      setLevelStatus("Invalid OHLC values. Please check your inputs.");
      return;
    }

    const P = (H + L + C) / 3;

    const levels = [
      {
        name: "Pivot Point",
        shortName: "P",
        price: P,
        color: colors.yellow,
        group: "Pivot"
      },
      {
        name: "Resistance 1",
        shortName: "R1",
        price: 2 * P - L,
        color: colors.green,
        group: "Resistance"
      },
      {
        name: "Resistance 2",
        shortName: "R2",
        price: P + (H - L),
        color: colors.green,
        group: "Resistance"
      },
      {
        name: "Resistance 3",
        shortName: "R3",
        price: H + 2 * (P - L),
        color: colors.green,
        group: "Resistance"
      },
      {
        name: "Support 1",
        shortName: "S1",
        price: 2 * P - H,
        color: colors.red,
        group: "Support"
      },
      {
        name: "Support 2",
        shortName: "S2",
        price: P - (H - L),
        color: colors.red,
        group: "Support"
      },
      {
        name: "Support 3",
        shortName: "S3",
        price: L - 2 * (H - P),
        color: colors.red,
        group: "Support"
      },
      {
        name: "Yesterday High",
        shortName: "YH",
        price: H,
        color: "#5795ff",
        group: "Previous Day"
      },
      {
        name: "Yesterday Low",
        shortName: "YL",
        price: L,
        color: "#b17cff",
        group: "Previous Day"
      }
    ];

    setCalculatedLevels(levels);
    setLevelStatus(
      `${levels.length} levels calculated for ${levelInstrument}`
    );
  };

  const addManualLevel = () => {
    const price = Number(levelPrice);

    if (
      !levelName.trim() ||
      !levelPrice.trim() ||
      !Number.isFinite(price) ||
      price <= 0
    ) {
      setLevelStatus("Enter a valid level name and price.");
      return;
    }

    const newLevel = {
      id: Date.now(),
      name: levelName.trim(),
      price,
      color: levelColor,
      style: levelStyle
    };

    setManualLevels((old) => [...old, newLevel]);
    setLevelName("");
    setLevelPrice("");
    setLevelStatus("Custom level added successfully.");
  };

  const resetLevels = () => {
    setPreviousOHLC({
      open: "",
      high: "",
      low: "",
      close: ""
    });

    setCalculatedLevels([]);
    setManualLevels([]);
    setLevelStatus("Levels reset. Enter previous-day OHLC.");
  };

  const removeManualLevel = (id) => {
    setManualLevels((old) => old.filter((item) => item.id !== id));
  };

  return (
    <div
      style={{
        background: colors.bg,
        color: colors.text,
        minHeight: "100vh",
        padding: 20,
        fontFamily: "Inter, Arial, sans-serif"
      }}
    >
      {/* HEADER */}

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 12,
          marginBottom: 22
        }}
      >
        <div>
          <div
            style={{
              color: colors.blue,
              fontSize: 12,
              fontWeight: 700
            }}
          >
            PULSE TERMINAL / QUANT LAB
          </div>

          <h1 style={{ fontSize: 25, margin: "7px 0" }}>
            Strategy Studio
          </h1>

          <div style={{ color: colors.muted, fontSize: 13 }}>
            Build custom indicators, trading signals and market levels.
          </div>
        </div>

        <div
          style={{
            background: "#12352f",
            color: colors.green,
            borderRadius: 20,
            padding: "8px 13px",
            fontSize: 12
          }}
        >
          ● Strategy Workspace
        </div>
      </div>

      {/* TABS */}

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 9,
          marginBottom: 18
        }}
      >
        <button
          style={tabStyle(tab === "editor")}
          onClick={() => setTab("editor")}
        >
          Code Editor
        </button>

        <button
          style={tabStyle(tab === "builder")}
          onClick={() => setTab("builder")}
        >
          Visual Builder
        </button>

        <button
          style={tabStyle(tab === "levels")}
          onClick={() => setTab("levels")}
        >
          Daily Levels
        </button>

        <button
          style={tabStyle(tab === "signals")}
          onClick={() => setTab("signals")}
        >
          Signal Settings
        </button>
      </div>

      {/* CODE EDITOR */}

      {tab === "editor" && (
        <div style={{ ...card, marginBottom: 16 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: 10,
              marginBottom: 14
            }}
          >
            <div>
              <b>Strategy Editor</b>

              <div
                style={{
                  fontSize: 12,
                  color: colors.muted,
                  marginTop: 5
                }}
              >
                Write or paste your custom strategy script
              </div>
            </div>

            <button
              onClick={runStrategy}
              style={{
                background: colors.green,
                color: "#04130f",
                border: 0,
                borderRadius: 8,
                padding: "10px 20px",
                fontWeight: 800,
                cursor: "pointer"
              }}
            >
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

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 10,
              flexWrap: "wrap",
              marginTop: 12,
              color: colors.muted,
              fontSize: 12
            }}
          >
            <span>Pulse Script · Draft</span>
            <span>{script.split("\n").length} lines</span>
          </div>
        </div>
      )}

      {/* VISUAL BUILDER */}

      {tab === "builder" && (
        <div style={card}>
          <h3>Visual Strategy Builder</h3>

          <p style={{ color: colors.muted, fontSize: 13 }}>
            Configure conditions without writing code.
          </p>

          <div style={{ display: "flex", gap: 9, flexWrap: "wrap" }}>
            {["Indicators", "Price Action", "Volume", "Momentum"].map(
              (item) => (
                <button
                  key={item}
                  onClick={() => setActiveTool(item)}
                  style={tabStyle(activeTool === item)}
                >
                  {item}
                </button>
              )
            )}
          </div>

          <div
            style={{
              marginTop: 18,
              padding: 18,
              background: "#080e19",
              borderRadius: 9,
              border: `1px solid ${colors.border}`
            }}
          >
            <b>{activeTool}</b>

            <p style={{ color: colors.muted, fontSize: 13 }}>
              Indicator and condition configuration will be added in the next
              stage.
            </p>

            <div style={{ color: colors.green, fontSize: 13 }}>
              + Add condition
            </div>
          </div>
        </div>
      )}

      {/* DAILY LEVELS */}

      {tab === "levels" && (
        <div style={{ display: "grid", gap: 16 }}>

          <div style={card}>
            <h3 style={{ marginTop: 0 }}>Daily Automatic Levels</h3>

            <p style={{ color: colors.muted, fontSize: 13 }}>
              Traditional Pivot Points calculated from the previous completed
              trading session.
            </p>

            <label style={{ fontSize: 12, color: colors.muted }}>
              SELECT INSTRUMENT
            </label>

            <select
              value={levelInstrument}
              onChange={(e) => {
                setLevelInstrument(e.target.value);
                setCalculatedLevels([]);
                setLevelStatus("Enter OHLC for selected instrument.");
              }}
              style={{ ...inputStyle, marginTop: 7 }}
            >
              <option value="NIFTY 50">NIFTY 50</option>
              <option value="BANKNIFTY">BANKNIFTY</option>
            </select>

            <h4 style={{ marginBottom: 8 }}>
              Previous Trading Session OHLC
            </h4>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                gap: 10
              }}
            >
              {[
                ["open", "Open"],
                ["high", "High"],
                ["low", "Low"],
                ["close", "Close"]
              ].map(([key, label]) => (
                <div key={key}>
                  <label
                    style={{
                      fontSize: 12,
                      color: colors.muted
                    }}
                  >
                    {label}
                  </label>

                  <input
                    type="number"
                    min="0"
                    step="any"
                    placeholder={`${label} price`}
                    value={previousOHLC[key]}
                    onChange={(e) =>
                      setPreviousOHLC((old) => ({
                        ...old,
                        [key]: e.target.value
                      }))
                    }
                    style={{ ...inputStyle, marginTop: 6 }}
                  />
                </div>
              ))}
            </div>

            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 10,
                marginTop: 18
              }}
            >
              <button
                onClick={calculateAutoLevels}
                style={{
                  flex: 1,
                  minWidth: 150,
                  background: colors.green,
                  color: "#04130f",
                  border: 0,
                  borderRadius: 8,
                  padding: 13,
                  fontWeight: 800,
                  cursor: "pointer"
                }}
              >
                Calculate Pivot Levels
              </button>

              <button
                onClick={resetLevels}
                style={{
                  background: "#202b3c",
                  color: colors.text,
                  border: `1px solid ${colors.border}`,
                  borderRadius: 8,
                  padding: "12px 18px",
                  cursor: "pointer"
                }}
              >
                Reset
              </button>
            </div>

            <p
              style={{
                color: colors.green,
                fontSize: 12,
                marginBottom: 0
              }}
            >
              {levelStatus}
            </p>
          </div>

          {/* CALCULATED LEVELS */}

          <div style={card}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                flexWrap: "wrap",
                gap: 8
              }}
            >
              <h3 style={{ marginTop: 0 }}>Calculated Levels</h3>

              <span style={{ color: colors.muted, fontSize: 12 }}>
                {levelInstrument} · Traditional
              </span>
            </div>

            {calculatedLevels.length === 0 ? (
              <p style={{ color: colors.muted, fontSize: 13 }}>
                Enter previous-day OHLC and calculate to see levels here.
              </p>
            ) : (
              calculatedLevels.map((item) => (
                <div
                  key={item.shortName}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 10,
                    padding: "13px 4px",
                    borderBottom: `1px solid ${colors.border}`
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10
                    }}
                  >
                    <span
                      style={{
                        width: 4,
                        height: 28,
                        borderRadius: 5,
                        background: item.color
                      }}
                    />

                    <div>
                      <b>{item.name}</b>

                      <div
                        style={{
                          fontSize: 11,
                          color: colors.muted,
                          marginTop: 3
                        }}
                      >
                        {item.shortName}
                      </div>
                    </div>
                  </div>

                  <strong
                    style={{
                      color: item.color,
                      fontFamily: "monospace"
                    }}
                  >
                    {formatPrice(item.price)}
                  </strong>
                </div>
              ))
            )}
          </div>

          {/* CUSTOM LEVELS */}

          <div style={card}>
            <h3 style={{ marginTop: 0 }}>Custom Manual Levels</h3>

            <p style={{ color: colors.muted, fontSize: 13 }}>
              Add your own important levels and price zones.
            </p>

            <div style={{ display: "grid", gap: 10 }}>
              <input
                value={levelName}
                onChange={(e) => setLevelName(e.target.value)}
                placeholder="Level name e.g. Important Level"
                style={inputStyle}
              />

              <input
                type="number"
                min="0"
                step="any"
                value={levelPrice}
                onChange={(e) => setLevelPrice(e.target.value)}
                placeholder="Price"
                style={inputStyle}
              />

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 10
                }}
              >
                <div>
                  <label style={{ color: colors.muted, fontSize: 12 }}>
                    Line colour
                  </label>

                  <input
                    type="color"
                    value={levelColor}
                    onChange={(e) => setLevelColor(e.target.value)}
                    style={{
                      width: "100%",
                      height: 42,
                      marginTop: 5,
                      background: "#080e19",
                      border: `1px solid ${colors.border}`,
                      borderRadius: 8
                    }}
                  />
                </div>

                <div>
                  <label style={{ color: colors.muted, fontSize: 12 }}>
                    Line style
                  </label>

                  <select
                    value={levelStyle}
                    onChange={(e) => setLevelStyle(e.target.value)}
                    style={{ ...inputStyle, marginTop: 5 }}
                  >
                    <option value="solid">Solid</option>
                    <option value="dashed">Dashed</option>
                    <option value="dotted">Dotted</option>
                  </select>
                </div>
              </div>

              <button
                onClick={addManualLevel}
                style={{
                  background: "#1b3150",
                  color: "#8ebaff",
                  border: `1px solid ${colors.blue}`,
                  borderRadius: 8,
                  padding: 12,
                  fontWeight: 700,
                  cursor: "pointer"
                }}
              >
                + Add Custom Level
              </button>
            </div>

            {manualLevels.map((item) => (
              <div
                key={item.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 10,
                  borderBottom: `1px solid ${colors.border}`,
                  padding: "12px 2px"
                }}
              >
                <div>
                  <b style={{ color: item.color }}>{item.name}</b>

                  <div
                    style={{
                      color: colors.muted,
                      fontSize: 11,
                      marginTop: 3
                    }}
                  >
                    {item.style} line
                  </div>
                </div>

                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12
                  }}
                >
                  <strong>{formatPrice(item.price)}</strong>

                  <button
                    onClick={() => removeManualLevel(item.id)}
                    style={{
                      background: "transparent",
                      border: 0,
                      color: colors.red,
                      cursor: "pointer",
                      fontSize: 18
                    }}
                  >
                    ×
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div
            style={{
              ...card,
              borderColor: "#806a36"
            }}
          >
            <b style={{ color: colors.yellow }}>
              Engine Integration Status
            </b>

            <p
              style={{
                color: colors.muted,
                fontSize: 12,
                lineHeight: 1.7,
                marginBottom: 0
              }}
            >
              Traditional Pivot calculation and custom level configuration
              are available in this interface. Automatic previous-session
              data retrieval, next-day rollover, persistent storage and
              live chart plotting are planned for the next integration stage.
            </p>
          </div>
        </div>
      )}

      {/* SIGNAL SETTINGS */}

      {tab === "signals" && (
        <div style={card}>
          <h3>Signal Configuration</h3>

          <p style={{ color: colors.muted, fontSize: 13 }}>
            Choose the data categories for your strategy.
          </p>

          {[
            "Price Action",
            "EMA / SMA",
            "VWAP",
            "Volume Analysis",
            "RSI / Momentum",
            "Support & Resistance"
          ].map((item) => (
            <div
              key={item}
              style={{
                padding: 13,
                borderBottom: `1px solid ${colors.border}`,
                display: "flex",
                justifyContent: "space-between",
                gap: 10
              }}
            >
              {item}

              <span style={{ color: colors.green }}>
                Available for configuration
              </span>
            </div>
          ))}
        </div>
      )}

      {/* CHART PREVIEW */}

      <div style={{ ...card, marginTop: 16 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 10
          }}
        >
          <b>Chart Preview</b>

          <span style={{ fontSize: 12, color: colors.muted }}>
            {levelInstrument} · Preview
          </span>
        </div>

        <div
          style={{
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
          }}
        >
          Chart overlay integration will be connected in the next stage.
        </div>
      </div>

      {/* ENGINE STATUS */}

      <div
        style={{
          ...card,
          marginTop: 16,
          display: "flex",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 10,
          fontSize: 12
        }}
      >
        <span style={{ color: colors.muted }}>Engine Status</span>

        <span style={{ color: colors.green }}>{status}</span>
      </div>

      <p
        style={{
          color: colors.muted,
          fontSize: 11,
          marginTop: 18,
          textAlign: "center"
        }}
      >
        PULSE STRATEGY STUDIO · FOUNDATION BUILD
      </p>
    </div>
  );
}
