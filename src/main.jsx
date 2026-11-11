import React,{useEffect,useMemo,useRef,useState} from 'react';
import{createRoot}from'react-dom/client';
import{createChart,ColorType,CandlestickSeries,HistogramSeries,LineSeries}from'lightweight-charts';
import{Activity,ArrowDownRight,ArrowUpRight,Bell,BookOpen,BriefcaseBusiness,CalendarDays,ChartCandlestick,ChartNoAxesCombined,ChevronDown,ChevronLeft,ChevronRight,CircleHelp,Command,Compass,Filter,Globe,Grid2X2,Layers3,LayoutDashboard,Menu,Moon,MoreHorizontal,Newspaper,PanelRightClose,PanelRightOpen,Search,Settings,SlidersHorizontal,Sun,TrendingDown,TrendingUp,Wallet,Wifi,Zap}from'lucide-react';
import './style.css';

const NAV=[['Dashboard',LayoutDashboard],['Premarket',Sun],['Equity',Layers3],['Indices',ChartNoAxesCombined],['Options',Grid2X2],['F&O',Zap],['Insights',Compass],['News',Newspaper]];
const SIDE=[['Watchlist',SlidersHorizontal],['Heatmap',Grid2X2],['Screener',Filter],['Market Map',Globe],['FII / DII',Activity],['Economy',BriefcaseBusiness],['Calendar',CalendarDays],['Trading Journal',BookOpen]];
const newsData=[
{tag:'GLOBAL',time:'2 min ago',impact:'HIGH',title:'Global markets assess the latest central-bank commentary',body:'Investors weigh policy signals, bond yields and the path of interest rates.'},
{tag:'ECONOMY',time:'12 min ago',impact:'MEDIUM',title:'India macro data remains in focus ahead of key releases',body:'Traders monitor growth, inflation and activity indicators for directional cues.'},
{tag:'COMMODITIES',time:'18 min ago',impact:'MEDIUM',title:'Crude oil slips as demand outlook remains uncertain',body:'Energy markets react to updated demand expectations and supply headlines.'},
{tag:'MARKET',time:'26 min ago',impact:'HIGH',title:'Institutional flows remain on traders’ watchlist',body:'Cash-market activity and derivatives positioning may shape near-term sentiment.'},
{tag:'POLICY',time:'41 min ago',impact:'MEDIUM',title:'RBI commentary keeps liquidity and rates in focus',body:'Market participants parse policy communication for implications across sectors.'},
{tag:'CORPORATE',time:'54 min ago',impact:'LOW',title:'Earnings calendar: companies to watch this week',body:'A compact look at upcoming corporate events and scheduled announcements.'}
];
const indices=[['NIFTY 50','24,856.75','+132.40','+0.54%',true],['BANKNIFTY','56,743.20','+381.10','+0.68%',true],['SENSEX','81,562.34','+420.61','+0.52%',true],['NIFTY IT','44,982.10','+612.45','+1.38%',true],['INDIA VIX','12.46','-0.38','-2.96%',false]];
const movers=[['RELIANCE','2,948.50','+18.40','+0.63%'],['HDFCBANK','1,688.20','+10.15','+0.61%'],['ICICIBANK','1,321.90','+8.75','+0.67%'],['LT','3,467.00','+21.50','+0.62%'],['INFY','1,642.80','+12.10','+0.74%']];
const losers=[['TATASTEEL','142.80','-2.10','-1.45%'],['ONGC','256.40','-4.90','-1.92%'],['BPCL','316.25','-5.30','-1.65%'],['GRASIM','2,698.70','-38.50','-1.41%'],['WIPRO','298.10','-2.60','-0.86%']];
const global=[['🇺🇸','Dow Jones','44,938.31','+0.41%'],['🇺🇸','S&P 500','6,101.24','+0.47%'],['🇺🇸','Nasdaq','19,862.54','+0.55%'],['🇪🇺','DAX','19,445.36','+0.32%'],['🇯🇵','Nikkei 225','38,420.14','+0.71%'],['🇭🇰','Hang Seng','26,809.14','+0.63%']];
const sectors=[['IT','+1.38%'],['Banking','+0.68%'],['Auto','+0.54%'],['FMCG','+0.27%'],['Pharma','+0.49%'],['Metal','-0.36%'],['Energy','-0.18%'],['Realty','+0.63%']];
const fmt=(v)=>Number(v).toLocaleString('en-IN',{maximumFractionDigits:2});

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
function Chart({liveTick, symbol}){
 const ref=useRef(null);
 const chartRef=useRef(null);
 const candleRef=useRef(null);
 const minuteRef=useRef(null);

 // Create chart
 useEffect(()=>{
  if(!ref.current)return;

  const chart=createChart(ref.current,{
   width:ref.current.clientWidth,
   height:330,
   layout:{
    background:{type:ColorType.Solid,color:'#0a1217'},
    textColor:'#91a2a9',
    fontFamily:'JetBrains Mono',
    fontSize:10
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
    chart.applyOptions({width:ref.current.clientWidth});
   }
  });

  ro.observe(ref.current);

  return()=>{
   ro.disconnect();
   chart.remove();
   chartRef.current=null;
   candleRef.current=null;
   minuteRef.current=null;
  };
 },[]);

 // Fetch historical candles whenever selected symbol changes
 useEffect(()=>{
  let cancelled=false;

  async function loadHistory(){
   if(!candleRef.current)return;

   candleRef.current.setData([]);
   minuteRef.current=null;

   try{
    const url=
     `https://retail-bloomberg-2.onrender.com/api/v1/market/candles?symbol=${encodeURIComponent(symbol)}&interval=ONE_MINUTE&days=5`;

    const response=await fetch(url);

    if(!response.ok){
     throw new Error(`Historical API error: ${response.status}`);
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

    if(candles.length){
     candleRef.current.setData(candles);
     minuteRef.current=candles[candles.length-1];
     chartRef.current?.timeScale().fitContent();
    }

    console.log(
     `${symbol}: ${candles.length} historical candles loaded`
    );

   }catch(error){
    console.error('Historical candle loading failed:',error);
   }
  }

  loadHistory();

  return()=>{cancelled=true};
 },[symbol]);

 // Update the current candle with live ticks
 useEffect(()=>{
  if(!liveTick||!candleRef.current)return;

  const price=Number(liveTick.price);

  if(!Number.isFinite(price)||price<=0)return;

  const stamp=liveTick.received_at
   ?new Date(liveTick.received_at)
   :new Date();

  const epoch=Math.floor(stamp.getTime()/60000)*60;

  if(!Number.isFinite(epoch))return;

  const current=minuteRef.current;

  if(!current||epoch>current.time){
   const next={
    time:epoch,
    open:price,
    high:price,
    low:price,
    close:price
   };

   minuteRef.current=next;
   candleRef.current.update(next);

  }else if(epoch===current.time){
   const next={
    ...current,
    high:Math.max(current.high,price),
    low:Math.min(current.low,price),
    close:price
   };

   minuteRef.current=next;
   candleRef.current.update(next);
  }

 },[liveTick,symbol]);

 return <div className="chart" ref={ref}/>;
}
