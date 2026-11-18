import React,{useEffect,useRef,useState} from 'react';
import{createRoot}from'react-dom/client';
import{createChart,ColorType,CandlestickSeries}from'lightweight-charts';
import{Activity,Bell,BookOpen,BriefcaseBusiness,CalendarDays,ChartNoAxesCombined,ChevronDown,ChevronRight,Code2,Compass,Filter,Globe,Grid2X2,Layers3,LayoutDashboard,Menu,Moon,MoreHorizontal,Newspaper,Search,SlidersHorizontal,Sun,TrendingDown,TrendingUp,Zap}from'lucide-react';
import './style.css';
import StrategyStudio from './strategy/StrategyStudio';
import { generateDailyLevels } from './strategy/dailyLevelsEngine';
const NAV=[['Dashboard',LayoutDashboard],['Premarket',Sun],['Equity',Layers3],['Indices',ChartNoAxesCombined],['Options',Grid2X2],['F&O',Zap],['Insights',Compass],['News',Newspaper],['Strategy Studio',Code2]];
const SIDE=[['Watchlist',SlidersHorizontal],['Heatmap',Grid2X2],['Screener',Filter],['Market Map',Globe],['FII / DII',Activity],['Economy',BriefcaseBusiness],['Calendar',CalendarDays],['Trading Journal',BookOpen]];

const newsData=[
 {tag:'GLOBAL',time:'2 min ago',impact:'HIGH',title:'Global markets assess the latest central-bank commentary',body:'Investors weigh policy signals, bond yields and the path of interest rates.'},
 {tag:'ECONOMY',time:'12 min ago',impact:'MEDIUM',title:'India macro data remains in focus ahead of key releases',body:'Traders monitor growth, inflation and activity indicators for directional cues.'},
 {tag:'COMMODITIES',time:'18 min ago',impact:'MEDIUM',title:'Crude oil slips as demand outlook remains uncertain',body:'Energy markets react to updated demand expectations and supply headlines.'},
 {tag:'MARKET',time:'26 min ago',impact:'HIGH',title:'Institutional flows remain on traders’ watchlist',body:'Cash-market activity and derivatives positioning may shape near-term sentiment.'},
 {tag:'POLICY',time:'41 min ago',impact:'MEDIUM',title:'RBI commentary keeps liquidity and rates in focus',body:'Market participants parse policy communication for implications across sectors.'},
 {tag:'CORPORATE',time:'54 min ago',impact:'LOW',title:'Earnings calendar: companies to watch this week',body:'A compact look at upcoming corporate events and scheduled announcements.'}
];

const movers=[['RELIANCE','2,948.50','+18.40','+0.63%'],['HDFCBANK','1,688.20','+10.15','+0.61%'],['ICICIBANK','1,321.90','+8.75','+0.67%'],['LT','3,467.00','+21.50','+0.62%'],['INFY','1,642.80','+12.10','+0.74%']];
const losers=[['TATASTEEL','142.80','-2.10','-1.45%'],['ONGC','256.40','-4.90','-1.92%'],['BPCL','316.25','-5.30','-1.65%'],['GRASIM','2,698.70','-38.50','-1.41%'],['WIPRO','298.10','-2.60','-0.86%']];
const global=[['🇺🇸','Dow Jones','44,938.31','+0.41%'],['🇺🇸','S&P 500','6,101.24','+0.47%'],['🇺🇸','Nasdaq','19,862.54','+0.55%'],['🇪🇺','DAX','19,445.36','+0.32%'],['🇯🇵','Nikkei 225','38,420.14','+0.71%'],['🇭🇰','Hang Seng','26,809.14','+0.63%']];
const sectors=[['IT','+1.38%'],['Banking','+0.68%'],['Auto','+0.54%'],['FMCG','+0.27%'],['Pharma','+0.49%'],['Metal','-0.36%'],['Energy','-0.18%'],['Realty','+0.63%']];

const fmt=v=>Number(v).toLocaleString('en-IN',{maximumFractionDigits:2});

const TIMEFRAME_CONFIG={
 '1m':{interval:'ONE_MINUTE',days:5,seconds:60},
 '5m':{interval:'FIVE_MINUTE',days:5,seconds:300},
 '15m':{interval:'FIFTEEN_MINUTE',days:5,seconds:900},
 '1D':{interval:'ONE_DAY',days:30,seconds:86400}
};

function getCandleTime(date,timeframe){
 const seconds=Math.floor(date.getTime()/1000);
 const config=TIMEFRAME_CONFIG[timeframe]||TIMEFRAME_CONFIG['1m'];

 if(timeframe==='1D'){
  const indiaOffset=19800;
  return Math.floor((seconds+indiaOffset)/86400)*86400-indiaOffset;
 }

 const indiaOffset=19800;
 const sessionStart=33300;
 return Math.floor((seconds+indiaOffset-sessionStart)/config.seconds)*config.seconds+sessionStart-indiaOffset;
}

function SectorStrip(){
 return <section className="panel" style={{marginTop:16,padding:16}}>
  <h3>Sector performance</h3>
  <div style={{display:'flex',gap:18,flexWrap:'wrap'}}>
   {sectors.map(([name,change])=>
    <span key={name}>{name} <b style={{color:change.startsWith('-')?'#ff6572':'#00d68b'}}>{change}</b></span>
   )}
  </div>
 </section>;
}

function Chart({
  liveTick,
  symbol,
  timeframe,
  levels = [],
  manualLevels = []
}){
 const ref=useRef(null);
 const chartRef=useRef(null);
 const candleRef=useRef(null);
 const currentCandleRef=useRef(null);
 const [historyStatus,setHistoryStatus]=useState('Loading history...');

 useEffect(()=>{
  if(!ref.current)return;

  const chart=createChart(ref.current,{
   width:ref.current.clientWidth,
   height:260,
   layout:{
    background:{type:ColorType.Solid,color:'#0a1217'},
    textColor:'#91a2a9',
    fontFamily:'JetBrains Mono',
    fontSize:10,

   },
   grid:{
    vertLines:{color:'#14232a'},
    horzLines:{color:'#14232a'}
   },
   rightPriceScale:{borderColor:'#263840'},
   timeScale:{
    borderColor:'#263840',
    timeVisible:true,
    secondsVisible:false
   },
   crosshair:{mode:1}
  });

  const candle=chart.addSeries(CandlestickSeries,{
   upColor:'#00d68b',
   downColor:'#ff6572',
   borderUpColor:'#00d68b',
   borderDownColor:'#ff6572',
   wickUpColor:'#00d68b',
   wickDownColor:'#ff6572'
  });

  chartRef.current=chart;
  candleRef.current=candle;

  const ro=new ResizeObserver(()=>{
   if(ref.current){
 chart.applyOptions({
  width:ref.current.clientWidth,
  height:ref.current.clientHeight
 });
}
  });

  ro.observe(ref.current);

  return()=>{
   ro.disconnect();
   chart.remove();
   chartRef.current=null;
   candleRef.current=null;
   currentCandleRef.current=null;
  };
 },[]);
 
 // DAILY LEVELS OVERLAY
 useEffect(() => {
  const series = candleRef.current;
  if (!series) return;

  const allLevels = [...levels, ...manualLevels];
  const priceLines = [];

  allLevels.forEach((item) => {
   const price = Number(item.price);
   if (!Number.isFinite(price) || price <= 0) return;

   const label = String(
    item.shortName || item.name || "Level"
   ).toUpperCase();

   const isYesterday =
    label.includes("YST HIGH") ||
    label.includes("YST LOW") ||
    label.includes("YESTERDAY HIGH") ||
    label.includes("YESTERDAY LOW");

   const isYesterdayHigh =
    label.includes("YST HIGH") ||
    label.includes("YESTERDAY HIGH");

   const isYesterdayLow =
    label.includes("YST LOW") ||
    label.includes("YESTERDAY LOW");

   const isRound = label.includes("ROUND");

   const lineStyle = isYesterday
    ? 1
    : isRound
    ? 0
    : item.style === "dashed"
    ? 2
    : item.style === "dotted"
    ? 1
    : 0;

   const line = series.createPriceLine({
    price,
    color: isYesterday
     ? "#ffffff"
     : isRound
     ? "#5795ff"
     : item.color || "#5795ff",
    lineWidth: item.highlighted ? 3 : 2,
    lineStyle,
    axisLabelVisible: true,
    title: isYesterday
     ? isYesterdayHigh
       ? "YST HIGH"
       : "YST LOW"
     : isRound
     ? ""
     : item.shortName || item.name || "Level"
   });

   priceLines.push(line);
  });

  return () => {
   priceLines.forEach((line) => {
    series.removePriceLine(line);
   });
  };
 }, [levels, manualLevels]);
 useEffect(()=>{
  let cancelled=false;

  async function loadHistory(){
    if(!candleRef.current)return;

    candleRef.current.setData([]);
   currentCandleRef.current=null;
   setHistoryStatus('Loading history...');

   const config=TIMEFRAME_CONFIG[timeframe]||TIMEFRAME_CONFIG['1m'];

   const url=`https://retail-bloomberg-2.onrender.com/api/v1/market/candles?symbol=${encodeURIComponent(symbol)}&interval=${config.interval}&days=${config.days}`;

   try{
    let response=null;

    for(let attempt=0;attempt<3;attempt++){
     if(cancelled)return;

     try{
      response=await fetch(url);
      if(response.ok)break;

      if(![502,503,504].includes(response.status)){
       throw new Error(`Historical API error: ${response.status}`);
      }

      if(attempt<2){
       setHistoryStatus(`Server busy. Retry ${attempt+1}/2...`);
       await new Promise(resolve=>setTimeout(resolve,1500));
      }
     }catch(error){
      if(error.message.startsWith('Historical API error:'))throw error;
      if(attempt===2)throw error;

      setHistoryStatus(`Connection retry ${attempt+1}/2...`);
      await new Promise(resolve=>setTimeout(resolve,1500));
     }
    }

    if(!response||!response.ok){
     throw new Error(`Historical API error: ${response?.status||'No response'}`);
    }

    const result=await response.json();
    if(cancelled)return;

    const candles=(result.candles||[])
     .map(c=>({
      time:Number(c.time),
      open:Number(c.open),
      high:Number(c.high),
      low:Number(c.low),
      close:Number(c.close)
     }))
     .filter(c=>
      Number.isFinite(c.time)&&
      Number.isFinite(c.open)&&
      Number.isFinite(c.high)&&
      Number.isFinite(c.low)&&
      Number.isFinite(c.close)
     )
     .sort((a,b)=>a.time-b.time);

    if(cancelled)return;

    if(candles.length){
     candleRef.current.setData(candles);
     currentCandleRef.current=candles[candles.length-1];
     chartRef.current?.timeScale().fitContent();
     setHistoryStatus(`${candles.length} ${timeframe} candles loaded`);
    }else{
     setHistoryStatus('API returned 0 candles');
    }

    console.log(`${symbol} ${timeframe}: ${candles.length} historical candles loaded`);

   }catch(error){
    if(!cancelled){
     setHistoryStatus('ERROR: '+error.message);
     console.error('Historical candle loading failed:',error);
    }
   }
  }

  loadHistory();
  return()=>{cancelled=true};
 },[symbol,timeframe]);

 useEffect(()=>{
  if(!liveTick||!candleRef.current)return;

  const price=Number(liveTick.price);
  if(!Number.isFinite(price)||price<=0)return;

  const stamp=liveTick.received_at?new Date(liveTick.received_at):new Date();
  if(!Number.isFinite(stamp.getTime()))return;

  const epoch=getCandleTime(stamp,timeframe);
  const current=currentCandleRef.current;
  if(!Number.isFinite(epoch))return;

  if(!current||epoch>current.time){
   const next={time:epoch,open:price,high:price,low:price,close:price};
   currentCandleRef.current=next;
   candleRef.current.update(next);
  }else if(epoch===current.time){
   const next={
    ...current,
    high:Math.max(current.high,price),
    low:Math.min(current.low,price),
    close:price
   };
   currentCandleRef.current=next;
   candleRef.current.update(next);
  }
 },[liveTick,symbol,timeframe]);

 return <div>
  <div style={{color:'#00d68b',fontSize:'12px',marginBottom:'8px'}}>
   {historyStatus}
  </div>
  <div className="chart" ref={ref} style={{height:260}}/>
 </div>;
}

function OptionChain({ ticks }) {
 const API = 'https://retail-bloomberg-2.onrender.com';

 const [underlying, setUnderlying] = useState('NIFTY');
 const [expiry, setExpiry] = useState('');
 const [expiries, setExpiries] = useState([]);
 const [contracts, setContracts] = useState([]);
 const [greeks, setGreeks] = useState([]);
 const [tab, setTab] = useState('chain');
 const [loading, setLoading] = useState(false);
 const [message, setMessage] = useState('Loading option chain...');
 const [greekStatus, setGreekStatus] = useState('');

 const indexToken = underlying === 'NIFTY'
  ? '99926000'
  : '99926009';

 const indexTick = ticks[indexToken];
 const indexPrice = Number(indexTick?.price) || 0;

 // Load available expiries
 useEffect(() => {
  let cancelled = false;

  async function loadExpiries() {
   setExpiry('');
   setExpiries([]);
   setContracts([]);
   setGreeks([]);
   setMessage('Loading expiries...');

   try {
    const response = await fetch(
     `${API}/api/v1/options/expiries?underlying=${underlying}`
    );

    if (!response.ok) {
     throw new Error(`Expiry API ${response.status}`);
    }

    const result = await response.json();

    const list = Array.isArray(result)
     ? result
     : result.expiries || [];

    if (cancelled) return;

    const valid = list
     .map(item => typeof item === 'string' ? item : item.expiry)
     .filter(Boolean)
     .sort();

    setExpiries(valid);

    if (valid.length) {
     setExpiry(valid[0]);
    } else {
     setMessage('No expiries available');
    }
   } catch (error) {
    if (!cancelled) {
     setMessage(error.message);
    }
   }
  }

  loadExpiries();

  return () => {
   cancelled = true;
  };
 }, [underlying]);

 // Load contracts and Greeks for selected expiry
 useEffect(() => {
  if (!expiry) return;

  let cancelled = false;

  async function loadChain() {
   setLoading(true);
   setContracts([]);
   setGreeks([]);
   setMessage('Loading contracts...');

   try {
    const [contractResponse, greekResponse] = await Promise.all([
     fetch(
      `${API}/api/v1/options/contracts?underlying=${underlying}&expiry=${expiry}`
     ),
     fetch(
      `${API}/api/v1/options/greeks?underlying=${underlying}&expiry=${expiry}`
     )
    ]);

    if (!contractResponse.ok) {
     throw new Error(`Contracts API ${contractResponse.status}`);
    }

    const contractResult = await contractResponse.json();
    const contractList = Array.isArray(contractResult)
     ? contractResult
     : contractResult.contracts || [];

    if (cancelled) return;

    setContracts(contractList);
    setMessage(
     contractList.length
      ? `${contractList.length} contracts loaded`
      : 'No contracts found'
    );

    if (greekResponse.ok) {
     const greekResult = await greekResponse.json();
     if (!cancelled) {
      setGreeks(greekResult.greeks || []);
      setGreekStatus('Greeks available');
     }
    } else {
     setGreekStatus('Greeks unavailable');
    }

   } catch (error) {
    if (!cancelled) {
     setMessage(error.message);
     setGreekStatus('Greeks unavailable');
    }
   } finally {
    if (!cancelled) setLoading(false);
   }
  }

  loadChain();

  return () => {
   cancelled = true;
  };
 }, [underlying, expiry]);

 const strikes = [...new Set(
  contracts.map(item => Number(item.strike))
 )].filter(Number.isFinite).sort((a, b) => a - b);

 // Find the nearest strike to the live index price
 const atmStrike = indexPrice && strikes.length
  ? strikes.reduce((closest, strike) =>
     Math.abs(strike - indexPrice) < Math.abs(closest - indexPrice)
      ? strike
      : closest
    , strikes[0])
  : null;

 const atmIndex = atmStrike === null
  ? -1
  : strikes.indexOf(atmStrike);

 const visibleStrikes = atmIndex >= 0
  ? strikes.slice(
     Math.max(0, atmIndex - 20),
     atmIndex + 21
    )
  : [];

 const visibleContracts = contracts.filter(item =>
  visibleStrikes.includes(Number(item.strike))
 );
const visibleTokenKey = visibleContracts
  .map(item => String(item.token))
  .join(',');
 // Subscribe to visible CE and PE contracts
 useEffect(() => {
  if (!visibleContracts.length || atmStrike === null) return;

  const tokens = visibleTokenKey.split(',').filter(Boolean);

  if (!tokens.length) return;

  fetch(`${API}/api/v1/market/subscribe`, {
   method: 'POST',
   headers: { 'Content-Type': 'application/json' },
   body: JSON.stringify({
    exchange: 'NFO',
    tokens,
    mode: 3
   })
  })
   .then(response => {
    if (!response.ok) {
     throw new Error(`Subscription API ${response.status}`);
    }
    return response.json();
   })
   .then(result => {
    console.log('Option chain subscription:', result);
   })
   .catch(error => {
    console.error('Option subscription failed:', error);
   });

 }, [visibleTokenKey, atmStrike]);

 const contractMap = {};
 contracts.forEach(item => {
  contractMap[`${Number(item.strike)}:${item.option_type}`] = item;
 });

 const greekMap = {};
 greeks.forEach(item => {
  greekMap[`${Number(item.strike)}:${item.option_type}`] = item;
 });

 function getOptionData(strike, type) {
  const contract = contractMap[`${strike}:${type}`];
  if (!contract) return null;

  const tick = ticks[String(contract.token)];
  const raw = tick?.raw || tick || {};
  const greek = greekMap[`${strike}:${type}`] || {};

  return {
   ltp: tick?.price ?? null,
   oi: raw.open_interest ?? raw.openInterest ?? null,
   volume: raw.volume_trade_for_the_day ?? raw.volume ?? null,
   iv: greek.iv ?? null,
   delta: greek.delta ?? null
  };
 }

 const number = value =>
  value === null || value === undefined || !Number.isFinite(Number(value))
   ? '—'
   : Number(value).toLocaleString('en-IN', {
      maximumFractionDigits: 2
     });

 return (
  <section className="panel option-chain-panel">

   <div className="option-chain-heading">
    <div>
     <span className="eyebrow">DERIVATIVES MARKET</span>
     <h2>Option Chain</h2>
     <div className="option-chain-subtitle">
      Live options market data · Angel One
     </div>
    </div>

    <div className="option-chain-status">
     <span className={indexPrice ? 'dot live' : 'dot'} />
     {indexPrice ? 'INDEX LIVE' : 'WAITING FOR INDEX'}
    </div>
   </div>

   <div className="option-chain-toolbar">

    <div className="option-chain-underlying">
     {['NIFTY', 'BANKNIFTY'].map(name => (
      <button
       key={name}
       className={underlying === name ? 'active' : ''}
       onClick={() => setUnderlying(name)}
      >
       {name}
      </button>
     ))}
    </div>

    <select
     value={expiry}
     onChange={event => setExpiry(event.target.value)}
     disabled={!expiries.length}
    >
     {expiries.map(date => (
      <option key={date} value={date}>{date}</option>
     ))}
    </select>

   </div>

   <div className="option-chain-summary">
    <div>
     <span>UNDERLYING</span>
     <b>{underlying}</b>
    </div>
    <div>
     <span>INDEX LTP</span>
     <b>{indexPrice ? number(indexPrice) : '—'}</b>
    </div>
    <div>
     <span>ATM STRIKE</span>
     <b>{atmStrike === null ? '—' : number(atmStrike)}</b>
    </div>
    <div>
     <span>VISIBLE STRIKES</span>
     <b>{visibleStrikes.length}</b>
    </div>
   </div>

   <div className="option-chain-tabs">
    <button
     className={tab === 'chain' ? 'active' : ''}
     onClick={() => setTab('chain')}
    >
     Option Chain
    </button>
    <button
     className={tab === 'oi' ? 'active' : ''}
     onClick={() => setTab('oi')}
    >
     OI Analytics
    </button>
    <button
     className={tab === 'greeks' ? 'active' : ''}
     onClick={() => setTab('greeks')}
    >
     Greeks & IV
    </button>
    <button
     className={tab === 'strategy' ? 'active' : ''}
     onClick={() => setTab('strategy')}
    >
     Strategy Builder
    </button>
   </div>

   {loading && (
    <div className="option-chain-message">Loading market data...</div>
   )}

   {!loading && !contracts.length && (
    <div className="option-chain-message">{message}</div>
   )}

   {tab === 'chain' && visibleStrikes.length > 0 && (
    <div className="option-chain-scroll">
     <table className="option-chain-table">
      <thead>
       <tr>
        <th colSpan="4" className="ce-heading">CALL OPTIONS (CE)</th>
        <th className="strike-heading">STRIKE</th>
        <th colSpan="4" className="pe-heading">PUT OPTIONS (PE)</th>
       </tr>
       <tr>
        <th>LTP</th>
        <th>OI</th>
        <th>VOLUME</th>
        <th>IV</th>
        <th>PRICE</th>
        <th>IV</th>
        <th>VOLUME</th>
        <th>OI</th>
        <th>LTP</th>
       </tr>
      </thead>

      <tbody>
       {visibleStrikes.map(strike => {
        const ce = getOptionData(strike, 'CE');
        const pe = getOptionData(strike, 'PE');
        const isATM = strike === atmStrike;

        return (
         <tr key={strike} className={isATM ? 'atm-row' : ''}>
          <td className="ce-value">{number(ce?.ltp)}</td>
          <td>{number(ce?.oi)}</td>
          <td>{number(ce?.volume)}</td>
          <td>{number(ce?.iv)}</td>

          <td className="strike-value">
           {number(strike)}
           {isATM && <small>ATM</small>}
          </td>

          <td>{number(pe?.iv)}</td>
          <td>{number(pe?.volume)}</td>
          <td>{number(pe?.oi)}</td>
          <td className="pe-value">{number(pe?.ltp)}</td>
         </tr>
        );
       })}
      </tbody>
     </table>
    </div>
   )}

   {tab === 'oi' && (
    <div className="option-chain-message">
     OI Analytics — live OI values are shown in the option chain.
     OI change requires a reliable previous-OI baseline.
    </div>
   )}

   {tab === 'greeks' && (
    <div className="option-chain-scroll">
     <div className="option-chain-message">{greekStatus}</div>
     <table className="option-chain-table">
      <thead>
       <tr>
        <th>STRIKE</th>
        <th>TYPE</th>
        <th>DELTA</th>
        <th>GAMMA</th>
        <th>THETA</th>
        <th>VEGA</th>
        <th>IV</th>
       </tr>
      </thead>
      <tbody>
       {greeks
        .filter(item => visibleStrikes.includes(Number(item.strike)))
        .map((item, index) => (
         <tr key={`${item.strike}-${item.option_type}-${index}`}>
          <td>{number(item.strike)}</td>
          <td>{item.option_type}</td>
          <td>{number(item.delta)}</td>
          <td>{number(item.gamma)}</td>
          <td>{number(item.theta)}</td>
          <td>{number(item.vega)}</td>
          <td>{number(item.iv)}</td>
         </tr>
        ))}
      </tbody>
     </table>
    </div>
   )}

   {tab === 'strategy' && (
    <div className="option-chain-message">
     Strategy Builder integration is the next stage.
    </div>
   )}

   <div className="option-chain-footer">
    <span>{message}</span>
    <span>{greekStatus}</span>
   </div>

  </section>
 );
}

function App(){
 const [active,setActive]=useState('Dashboard');
 const [dark,setDark]=useState(true);
 const [search,setSearch]=useState('');
 const [feedStatus,setFeedStatus]=useState('Connecting...');
 const [ticks,setTicks]=useState({});
 const [selected,setSelected]=useState('NIFTY 50');
 const [dashboardLevels,setDashboardLevels] = useState({
  "NIFTY 50": {
    levels: [],
    manualLevels: []
  },
  "BANKNIFTY": {
    levels: [],
    manualLevels: []
  }
});
 
useEffect(() => {
  let cancelled = false;

  async function loadDailyLevels() {
    const instruments = ["NIFTY 50", "BANKNIFTY"];

    for (const instrument of instruments) {
      try {
        const url =
          `https://retail-bloomberg-2.onrender.com/api/v1/market/candles?symbol=${encodeURIComponent(instrument)}&interval=ONE_DAY&days=10`;

        const response = await fetch(url);

        if (!response.ok) {
          throw new Error(`${instrument}: API ${response.status}`);
        }

        const result = await response.json();

        const candles = (result.candles || [])
          .map((c) => ({
            time: Number(c.time),
            open: Number(c.open),
            high: Number(c.high),
            low: Number(c.low),
            close: Number(c.close)
          }))
          .filter((c) =>
            Number.isFinite(c.time) &&
            Number.isFinite(c.open) &&
            Number.isFinite(c.high) &&
            Number.isFinite(c.low) &&
            Number.isFinite(c.close)
          )
          .sort((a, b) => a.time - b.time);

        if (!candles.length) {
          throw new Error("No daily candles received");
        }

        // Use the latest completed NSE session candle.
        const now = new Date();
        const indiaTime = new Intl.DateTimeFormat("en-GB", {
          timeZone: "Asia/Kolkata",
          hour: "2-digit",
          minute: "2-digit",
          hourCycle: "h23"
        }).format(now);

        const [hour, minute] = indiaTime.split(":").map(Number);
        const marketClosed = hour > 15 || (hour === 15 && minute >= 30);

        const today = new Intl.DateTimeFormat("en-CA", {
          timeZone: "Asia/Kolkata"
        }).format(now);

        const lastCandle = candles[candles.length - 1];

        const lastDate = new Intl.DateTimeFormat("en-CA", {
          timeZone: "Asia/Kolkata"
        }).format(new Date(lastCandle.time * 1000));

        let completedCandles = candles;

        if (lastDate === today && !marketClosed) {
          completedCandles = candles.slice(0, -1);
        }

        const previousSession =
          completedCandles[completedCandles.length - 1];

        if (!previousSession) {
          throw new Error("Previous completed session not found");
        }

        const generated = generateDailyLevels(instrument, {
          open: previousSession.open,
          high: previousSession.high,
          low: previousSession.low,
          close: previousSession.close
        });

        if (cancelled) return;

        setDashboardLevels((old) => ({
          ...old,
          [instrument]: {
            ...old[instrument],
            levels: generated.levels
          }
        }));

        console.log(
          `${instrument} levels generated from previous session`,
          previousSession,
          generated.levels
        );

      } catch (error) {
        console.error("Daily levels error:", instrument, error);
      }
    }
  }

  loadDailyLevels();

  const refresh = setInterval(loadDailyLevels, 5 * 60 * 1000);

  return () => {
    cancelled = true;
    clearInterval(refresh);
  };
}, []);
 
 const [niftyTimeframe,setNiftyTimeframe]=useState('1m');
const [bankTimeframe,setBankTimeframe]=useState('1m');
 const [clock,setClock]=useState(new Date());
 const [sidebar,setSidebar]=useState(true);
 const [notifications,setNotifications]=useState(false);

 const WS_URL='wss://retail-bloomberg-2.onrender.com/ws/market';

 useEffect(()=>{
  const timer=setInterval(()=>setClock(new Date()),1000);
  return()=>clearInterval(timer);
 },[]);

 useEffect(()=>{
  let ws,retry,stopped=false;

  const connect=()=>{
   if(stopped)return;

   ws=new WebSocket(WS_URL);
   ws.onopen=()=>setFeedStatus('WebSocket connected');

   ws.onmessage=(event)=>{
    try{
     const msg=JSON.parse(event.data);

     if(msg.type==='status'){
      const status=msg.feed||{};
      setFeedStatus(status.message||(status.connected?'Angel One connected':'Feed disconnected'));
     }

     if(msg.type==='tick'&&msg.data){
      const tick=msg.data;
      const token=String(tick.token||tick.symbol||'').split(':').pop();
      const price=Number(tick.price);

      if(!Number.isFinite(price)||price<=0)return;
      setTicks(old=>({...old,[token]:{...tick,token,price}}));
     }
    }catch(e){
     console.error('Market message error',e);
    }
   };

   ws.onerror=()=>setFeedStatus('Connection error');

   ws.onclose=()=>{
    if(!stopped){
     setFeedStatus('Reconnecting...');
     retry=setTimeout(connect,4000);
    }
   };
  };

  connect();

  return()=>{
   stopped=true;
   clearTimeout(retry);
   if(ws)ws.close();
  };
 },[]);

 const nifty=ticks['99926000'];
 const banknifty=ticks['99926009'];
 const livePrice=selected==='BANKNIFTY'?banknifty:nifty;
 const liveTick=selected==='BANKNIFTY'?banknifty:nifty;
 const isConnected=feedStatus.toLowerCase().includes('connected');

 const indexCards=[
  {name:'NIFTY 50',token:'99926000',tick:nifty},
  {name:'BANKNIFTY',token:'99926009',tick:banknifty},
  {name:'SENSEX',token:'',tick:null},
  {name:'NIFTY IT',token:'',tick:null},
  {name:'INDIA VIX',token:'',tick:null}
 ];

 const filteredNews=newsData.filter(item=>
  item.title.toLowerCase().includes(search.toLowerCase())||
  item.tag.toLowerCase().includes(search.toLowerCase())
 );

 return <div className={`app-shell ${dark?'dark':'light'}`}>
  <aside className={`sidebar ${sidebar?'':'collapsed'}`}>
   <div className="brand">
    <div className="brand-mark"><Activity size={22}/></div>
    {sidebar&&<div><strong>PULSE</strong><span>TERMINAL</span></div>}
   </div>

   <div className="side-label">WORKSPACE</div>

   {NAV.map(([name,Icon])=>
    <button key={name} className={`nav-item ${active===name?'active':''}`} onClick={()=>setActive(name)}>
     <Icon size={17}/>{sidebar&&<span>{name}</span>}
    </button>
   )}

   <div className="side-label">TOOLS</div>

   {SIDE.map(([name,Icon])=>
    <button key={name} className={`nav-item ${active===name?'active':''}`} onClick={()=>setActive(name)}>
     <Icon size={17}/>{sidebar&&<span>{name}</span>}
    </button>
   )}

   <div className="sidebar-bottom">
    <div className="connection-indicator">
     <span className={isConnected?'dot live':'dot'}></span>
     {sidebar&&feedStatus}
    </div>
    {sidebar&&<small>Pulse Terminal · Market Intelligence</small>}
   </div>
  </aside>

  <main className="main-area">
   <header className="topbar">
    <div className="top-left">
     <button className="icon-button" onClick={()=>setSidebar(!sidebar)}><Menu size={18}/></button>
     <div className="breadcrumb">Workspace <ChevronRight size={13}/> <b>{active}</b></div>
    </div>

    <div className="top-right">
     <div className="market-clock">{clock.toLocaleTimeString('en-IN',{hour12:false})} <span>IST</span></div>

     <div className="search-box">
      <Search size={15}/>
      <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search markets, news..."/>
     </div>

     <button className="icon-button" onClick={()=>setNotifications(!notifications)}><Bell size={17}/></button>
     <button className="icon-button" onClick={()=>setDark(!dark)}>{dark?<Sun size={17}/>:<Moon size={17}/>}</button>
     <div className="avatar">PT</div>
    </div>
   </header>

   <div className="market-strip">
    <div><span className="strip-label">MARKET STATUS</span><b className="market-status">LIVE FEED</b></div>
    <div><span className="strip-label">CONNECTION</span><b className={isConnected?'positive':'negative'}>{feedStatus}</b></div>
    <div><span className="strip-label">MARKET</span><b>NSE / BSE</b></div>
    <div><span className="strip-label">TIME</span><b>{clock.toLocaleTimeString('en-IN',{hour12:false})}</b></div>
   </div>
<section className="index-ticker">
 {indexCards.map(item=>{
  const price=item.tick?.price;
  return (
   <button
    key={item.name}
    className={`index-ticker-card ${selected===item.name?'selected':''}`}
    onClick={()=>{if(item.token)setSelected(item.name)}}
   >
    <span>{item.name}</span>
    <strong>{price?fmt(price):'—'}</strong>
    <small className={price?'positive':'muted'}>
     {price?'LIVE':'NO DATA'}
    </small>
   </button>
  );
 })}
</section>
   <div className="page-content">
    

    {active==='Dashboard'?<>
     

     

     <div className="dashboard-grid">
  
<section className="panel chart-panel">
<div style={{
  display:'grid',
  gridTemplateColumns:'repeat(2,minmax(0,1fr))',
  gap:12,
  marginTop:0
 }}>
  <div style={{minWidth:0}}>
   <div className="panel-heading">
    <div>
     <span className="eyebrow">NSE INDEX</span>
     <h2>NIFTY 50</h2>
    </div>
    <div className="chart-controls">
     {['1m','5m','15m','1D'].map(tf=>(
      <button key={tf} className={`timeframe ${niftyTimeframe===tf?'active':''}`} onClick={()=>setNiftyTimeframe(tf)}>{tf}</button>
     ))}
    </div>
   </div>
   <div className="chart-price">{nifty?fmt(nifty.price):'Waiting for live tick'}</div>
   <div className="chart-subtitle">Live {niftyTimeframe} candles · NIFTY 50</div>
   <Chart
  liveTick={nifty}
  symbol="NIFTY 50"
  timeframe={niftyTimeframe}
  levels={dashboardLevels["NIFTY 50"].levels}
  manualLevels={dashboardLevels["NIFTY 50"].manualLevels}
/>
  </div>

  <div style={{minWidth:0}}>
   <div className="panel-heading">
    <div>
     <span className="eyebrow">NSE INDEX</span>
     <h2>BANKNIFTY</h2>
    </div>
    <div className="chart-controls">
     {['1m','5m','15m','1D'].map(tf=>(
      <button key={tf} className={`timeframe ${bankTimeframe===tf?'active':''}`} onClick={()=>setBankTimeframe(tf)}>{tf}</button>
     ))}
    </div>
   </div>
   <div className="chart-price">{banknifty?fmt(banknifty.price):'Waiting for live tick'}</div>
   <div className="chart-subtitle">Live {bankTimeframe} candles · BANKNIFTY</div>
   <Chart
  liveTick={banknifty}
  symbol="BANKNIFTY"
  timeframe={bankTimeframe}
  levels={dashboardLevels["BANKNIFTY"].levels}
  manualLevels={dashboardLevels["BANKNIFTY"].manualLevels}
/>
  </div>
 </div>

 <div style={{marginTop:12,fontSize:11,color:'#91a2a9'}}>
  Source: Angel One WebSocket · Independent timeframes
 </div>
</section>


      <section className="panel news-panel">
       <div className="panel-heading">
        <div><span className="eyebrow">MARKET PULSE</span><h2>Latest headlines</h2></div>
        <button className="text-button" onClick={()=>setActive('News')}>View all <ChevronRight size={14}/></button>
       </div>

       <div className="news-list">
        {filteredNews.slice(0,5).map((item,i)=>
         <article className="news-item" key={i}>
          <div className="news-meta">
           <span>{item.tag}</span>
           <time>{item.time}</time>
           <b className={item.impact==='HIGH'?'impact-high':'impact-medium'}>{item.impact}</b>
          </div>
          <h3>{item.title}</h3>
          <p>{item.body}</p>
         </article>
        )}
       </div>
      </section>
     </div>

     <SectorStrip/>

     <div className="dashboard-grid lower-grid">
      <section className="panel">
       <div className="panel-heading"><div><span className="eyebrow">NSE / BSE</span><h2>Top gainers</h2></div><TrendingUp size={18}/></div>
       {movers.map(row=><div className="stock-row" key={row[0]}><b>{row[0]}</b><span>{row[1]}</span><strong className="positive">{row[3]}</strong></div>)}
       <div className="demo-note">Illustrative watchlist · Not live market data</div>
      </section>

      <section className="panel">
       <div className="panel-heading"><div><span className="eyebrow">NSE / BSE</span><h2>Top losers</h2></div><TrendingDown size={18}/></div>
       {losers.map(row=><div className="stock-row" key={row[0]}><b>{row[0]}</b><span>{row[1]}</span><strong className="negative">{row[3]}</strong></div>)}
       <div className="demo-note">Illustrative watchlist · Not live market data</div>
      </section>

      <section className="panel">
       <div className="panel-heading"><div><span className="eyebrow">GLOBAL MARKETS</span><h2>World indices</h2></div><Globe size={18}/></div>
       {global.map(row=><div className="stock-row" key={row[1]}><b>{row[0]} {row[1]}</b><span>{row[2]}</span><strong className="positive">{row[3]}</strong></div>)}
       <div className="demo-note">Illustrative sample data</div>
      </section>
     </div>

    </>:active==='Strategy Studio'?<StrategyStudio/>:<section className="panel section-placeholder">
      <div className="placeholder-icon"><Activity size={28}/></div>
      <h2>{active}</h2>
      <p>This workspace section is being connected to verified market data.</p>
      <span className="feed-badge">Live integration in progress</span>
     </section>}

    <footer className="footer">
     <span>© 2026 PULSE TERMINAL</span>
     <span>Market intelligence workspace · Data availability depends on feed connection</span>
    </footer>
   </div>
  </main>
 </div>;
}

createRoot(document.getElementById('root')).render(<App/>);
