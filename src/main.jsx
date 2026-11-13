
import React,{useEffect,useRef,useState} from 'react';
import{createRoot}from'react-dom/client';
import{createChart,ColorType,CandlestickSeries}from'lightweight-charts';
import{Activity,Bell,BookOpen,BriefcaseBusiness,CalendarDays,ChartNoAxesCombined,ChevronDown,ChevronRight,Compass,Filter,Globe,Grid2X2,Layers3,LayoutDashboard,Menu,Moon,MoreHorizontal,Newspaper,Search,SlidersHorizontal,Sun,TrendingDown,TrendingUp,Zap}from'lucide-react';
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

function Chart({liveTick,symbol,timeframe}){
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

function App(){
 const [active,setActive]=useState('Dashboard');
 const [dark,setDark]=useState(true);
 const [search,setSearch]=useState('');
 const [feedStatus,setFeedStatus]=useState('Connecting...');
 const [ticks,setTicks]=useState({});
 const [selected,setSelected]=useState('NIFTY 50');
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

   <div className="page-content">
    <div className="page-heading">
     <div>
      <div className="eyebrow">MARKET INTELLIGENCE / INDIA</div>
      <h1>{active}</h1>
      <p>Real-time market intelligence, data and insights.</p>
     </div>

     <div className="heading-actions">
      <span className={`feed-badge ${isConnected?'connected':''}`}><span className="dot"></span>{feedStatus}</span>
      <button className="outline-button"><CalendarDays size={15}/> Today <ChevronDown size={14}/></button>
     </div>
    </div>

    {active==='Dashboard'?<>
     <section className="index-grid">
      {indexCards.map(item=>{
       const price=item.tick?.price;

       return <button key={item.name} className={`index-card ${selected===item.name?'selected':''}`} onClick={()=>{if(item.token)setSelected(item.name)}}>
        <div className="card-top"><span>{item.name}</span><MoreHorizontal size={16}/></div>
        <div className="index-price">{price?fmt(price):'—'}</div>
        <div className="index-change">{price?'Live tick received':'Awaiting verified feed'}</div>
        <div className="mini-chart"><span className={price?'positive':'muted'}>{price?'LIVE':'NO DATA'}</span></div>
       </button>;
      })}
     </section>

     <div className="section-title"><h2>Market overview</h2><span>Live market data</span></div>

     <div className="dashboard-grid">
  
<section className="panel chart-panel">
 <div className="panel-heading">
  <div>
   <span className="eyebrow">PRICE ACTION</span>
   <h2>Dual Index Charts</h2>
  </div>
 </div>

 <div style={{
  display:'grid',
  gridTemplateColumns:'repeat(2,minmax(0,1fr))',
  gap:12,
  marginTop:16
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
   <Chart liveTick={nifty} symbol="NIFTY 50" timeframe={niftyTimeframe}/>
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
   <Chart liveTick={banknifty} symbol="BANKNIFTY" timeframe={bankTimeframe}/>
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

    </>:<section className="panel section-placeholder">
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
