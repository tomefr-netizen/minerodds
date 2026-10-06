import { estimate, YEAR } from './math.js';

const $ = id => document.getElementById(id);
const state = { coins: [], mode: 'solo', sort: 'year', descending: true, selected: null, snapshot: null, valid: true, currency:'USD', exchange:{rates:{USD:1},dates:{}} };
const defaults = { hashrate: 1, uptime: 100, power: 20, electricity: 0.15, fee: 1 };
const limits = { hashrate: 1e9, uptime: 100, power: 1e9, electricity: 1000, fee: 100 };
const fmt = (value, digits = 2) => Number(value).toLocaleString('en-US', { maximumFractionDigits: digits });
const exchangeRate = () => state.exchange.rates[state.currency];
const money = value => {
  if (value === null || !Number.isFinite(value)) return 'Unavailable';
  const amount = value * exchangeRate();
  return amount.toLocaleString('en-US', { style:'currency', currency:state.currency, currencyDisplay:state.currency === 'USD' ? 'symbol' : 'code', minimumFractionDigits:2, maximumFractionDigits:Math.abs(amount)<.01 && amount!==0 ? 5 : 2 });
};
const pct = value => value === null ? '\u2014' : value === 0 ? '0%' : value >= 99.995 ? '>99.99%' : value < .000001 ? `${value.toExponential(2)}%` : `${fmt(value, value < .01 ? 6 : value < 1 ? 4 : 2)}%`;
const quantity = value => value === null ? '\u2014' : value !== 0 && Math.abs(value) < .000001 ? value.toExponential(3) : fmt(value, 8);
const wait = years => !Number.isFinite(years) ? '\u2014' : years < 1 / 365 ? `${fmt(years * 365 * 24, 2)} hours` : years < 1 ? `${fmt(years * 365, 1)} days` : `${fmt(years, years < 10 ? 2 : 0)} years`;
const hash = value => { if (!value) return '\u2014'; for (const [unit, scale] of [['EH/s',1e18],['PH/s',1e15],['TH/s',1e12],['GH/s',1e9]]) if (value >= scale) return `${fmt(value/scale)} ${unit}`; return `${fmt(value)} H/s`; };
const date = unix => unix ? new Date(unix * 1000).toLocaleString('en-US', { month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' }) : 'Unavailable';
const escape = value => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const icons = () => window.lucide?.createIcons();

try {
  const saved = JSON.parse(localStorage.getItem('minerodds-settings') || '{}');
  for (const key of Object.keys(defaults)) if (Number.isFinite(saved[key]) && saved[key] >= 0 && saved[key] <= limits[key]) $(key).value = saved[key];
} catch {}

function settings() {
  const values = {};
  let invalid = false;
  for (const key of Object.keys(defaults)) {
    const input = $(key);
    values[key] = input.value === '' ? NaN : Number(input.value) / (key === 'electricity' ? exchangeRate() : 1);
    const bad = !Number.isFinite(values[key]) || values[key] < 0 || values[key] > limits[key];
    input.setAttribute('aria-invalid', String(bad));
    invalid ||= bad;
  }
  state.valid = !invalid;
  $('input-error').hidden = !invalid;
  $('input-error').textContent = 'Enter valid, non-negative numbers. Uptime and pool fee must be between 0 and 100%.';
  if (!invalid) try { localStorage.setItem('minerodds-settings', JSON.stringify(values)); } catch {}
  document.querySelectorAll('[data-hash]').forEach(button => button.classList.toggle('active', Number(button.dataset.hash) === values.hashrate));
  return values;
}

function rows() {
  const config = settings();
  if (!state.valid) return [];
  const query = $('search').value.trim().toLowerCase();
  const result = state.coins.filter(coin => `${coin.symbol} ${coin.name}`.toLowerCase().includes(query)).map(coin => {
    const calc = estimate(coin, config);
    return {...coin, ...calc, blockValue: coin.reward && coin.price ? coin.reward*coin.price : null, netMonth:calc.profit === null ? null : calc.profit*30, netYear:calc.profit === null ? null : calc.profit*365};
  });
  return result.sort((a,b) => {
    const av = a[state.sort], bv = b[state.sort];
    if (av === null || av === undefined) return bv === null || bv === undefined ? 0 : 1;
    if (bv === null || bv === undefined) return -1;
    const difference = typeof av === 'string' ? av.localeCompare(bv) : av === bv ? 0 : av - bv;
    return state.descending ? -difference : difference;
  });
}

function summaryItem(label, value, note, icon) {
  return `<div class="summary-item"><div class="summary-label"><i data-lucide="${icon}"></i>${label}</div><div class="summary-value">${value}</div><div class="summary-note">${note}</div></div>`;
}

function render() {
  const data = rows();
  const eligible = state.coins.map(coin => ({...coin, ...estimate(coin, defaultsFromInputs())})).filter(coin => coin.available && !coin.stale);
  const best = state.valid ? eligible.sort((a,b) => b.year - a.year)[0] : null;
  const bestProfit = state.valid ? eligible.filter(coin => coin.profit !== null && !coin.price_stale && !coin.reward_stale).sort((a,b) => b.profit - a.profit)[0] : null;
  if (state.mode === 'solo') {
    $('summary').innerHTML = summaryItem('Highest annual chance', best ? `${pct(best.year)} <small>${best.symbol}</small>` : '\u2014', 'At least one block in 365 days', 'sparkles') + summaryItem('Shortest mean wait', best ? wait(best.wait) : '\u2014', best ? `${best.name} \u00b7 at current difficulty` : 'Waiting for network data', 'timer') + summaryItem('Bitcoin block value', state.valid ? blockValue('BTC') : '\u2014', 'Average observed reward \u00b7 before fees', 'gem');
  } else {
    $('summary').innerHTML = summaryItem('Highest net earnings / day', bestProfit ? `${money(bestProfit.profit)} <small>${bestProfit.symbol}</small>` : '\u2014', 'After pool fee and electricity', 'wallet') + summaryItem('Electricity / day', state.valid ? money(estimate({available:false}, defaultsFromInputs()).electricity) : '\u2014', 'Power draw adjusted for uptime', 'zap') + summaryItem('Highest net earnings / month', bestProfit ? money(bestProfit.profit * 30) : '\u2014', '30 days \u00b7 fixed market conditions', 'calendar-days');
  }
  const columns = state.mode === 'solo' ? [['name','Coin'],['day','1 day'],['week','1 week'],['month','1 month'],['year','1 year'],['wait','Mean wait / block'],['blockValue',`Block value (${state.currency})`]] : [['name','Coin'],['yieldDay','Coins / day'],['revenue','Revenue / day'],['electricity','Electricity / day'],['profit','Net / day'],['netMonth','Net / month'],['netYear','Net / year'],['blockValue',`Block value (${state.currency})`]];
  $('table-head').innerHTML = `<tr>${columns.map(([key,label]) => `<th aria-sort="${key === state.sort ? state.descending ? 'descending' : 'ascending' : 'none'}"><button data-sort="${key}"${key==='blockValue'?' title="Observed block reward times coin price, before pool fees and electricity. Includes transaction fees in the observed reward."':''}>${label}<i data-lucide="${key === state.sort ? state.descending ? 'chevron-down' : 'chevron-up' : 'chevrons-up-down'}"></i></button></th>`).join('')}</tr>`;
  $('table-body').innerHTML = data.length ? data.map(coin => {
    const badge = !coin.available ? 'Unavailable' : coin.stale ? 'Stale network data' : coin.type === 'Direct' ? '' : coin.type;
    const logo = ['BTC','BCH','DGB','PPC'].includes(coin.symbol) ? `<img class="coin-logo" src="assets/coins/${coin.symbol.toLowerCase()}.png" alt="">` : `<span class="coin-logo coin-fallback">${coin.symbol}</span>`;
    const first = `<td><button class="coin-button" data-coin="${coin.symbol}" aria-label="Inspect ${escape(coin.name)}" aria-expanded="${state.selected === coin.symbol}">${logo}<span><span class="coin-name">${escape(coin.name)}</span><span class="coin-meta">${coin.symbol}${badge ? `<b>${badge}</b>` : ''}</span></span></button></td>`;
    const valueCell = `<td data-block-value="${coin.symbol}">${coin.reward && coin.price ? money(coin.reward*coin.price) : '\u2014'}${coin.price_stale || coin.reward_stale ? '<small class="dim"> *</small>' : ''}</td>`;
    const cells = state.mode === 'solo' ? ['day','week','month','year'].map(key => `<td class="${key==='year'?'chance':''}">${pct(coin[key])}</td>`).join('') + `<td class="wait">${coin.available ? wait(coin.wait) : '\u2014'}<small>${Number.isFinite(coin.wait) ? `${fmt(coin.wait, coin.wait < 1 ? 4 : 2)} years` : coin.available ? 'No active hashrate' : 'No difficulty data'}</small></td>${valueCell}` : `<td>${quantity(coin.yieldDay)}<span class="dim"> ${coin.symbol}</span></td><td>${money(coin.revenue)}</td><td>${money(coin.electricity)}</td><td class="${coin.profit === null ? 'dim' : coin.profit>=0?'money-positive':'money-negative'}">${money(coin.profit)}${coin.price_stale || coin.reward_stale || coin.stale ? ' *' : ''}</td><td>${money(coin.profit === null ? null : coin.profit*30)}</td><td>${money(coin.profit === null ? null : coin.profit*365)}</td>${valueCell}`;
    return `<tr class="${state.selected===coin.symbol?'selected':''}">${first}${cells}</tr>`;
  }).join('') : `<tr><td colspan="${columns.length}" class="empty">${!state.valid ? 'Check your mining settings above.' : state.coins.length ? 'No coins match your search.' : 'Network data could not be loaded. <button id="retry">Try again</button>'}</td></tr>`;
  $('coin-count').textContent = `${data.length} chains${state.mode === 'pool' ? ' \u00b7 * missing or stale price / reward / network data' : ' \u00b7 * missing or stale price / reward data'}`;
  $('export').disabled = !data.length;
  renderDetail();
  icons();
}

function defaultsFromInputs() { return Object.fromEntries(Object.keys(defaults).map(key => [key, Number($(key).value) / (key === 'electricity' ? exchangeRate() : 1)])); }
function blockValue(symbol) { const coin = state.coins.find(c => c.symbol === symbol); return coin?.reward && coin?.price ? `${money(coin.reward*coin.price)}${coin.price_stale || coin.reward_stale ? ' *' : ''}` : '\u2014'; }

function setCurrency(currency) {
  const electricity = $('electricity');
  const usdCost = electricity.value === '' ? null : Number(electricity.value) / exchangeRate();
  state.currency = currency;
  if (usdCost !== null && Number.isFinite(usdCost)) electricity.value = Number((usdCost * exchangeRate()).toPrecision(12));
  electricity.max = limits.electricity * exchangeRate();
  $('electricity-unit').textContent = `${currency === 'USD' ? '$' : currency}/kWh`;
  $('currency').value = currency;
  const rateDate = state.exchange.dates[currency];
  $('currency-status').textContent = `${currency}${currency !== 'USD' ? ` \u00b7 FX ${rateDate || 'date unavailable'}${state.exchange.stale ? ' (cached rate is stale)' : ''}` : ''}`;
  $('currency-status').title = currency === 'USD' ? 'Prices in USD' : `1 USD = ${exchangeRate()} ${currency}. Reference rates via Frankfurter / ECB. Retrieved ${date(state.exchange.updated_at)}.`;
}

function initializeCurrencies(exchange) {
  if (exchange?.rates?.USD === 1) state.exchange = exchange;
  const preferred = ['USD','SEK','EUR','GBP','NOK','DKK'];
  const codes = Object.keys(state.exchange.rates).filter(code => /^[A-Z]{3}$/.test(code) && Number.isFinite(state.exchange.rates[code]) && state.exchange.rates[code] > 0);
  codes.sort((a,b) => {
    const ai=preferred.indexOf(a), bi=preferred.indexOf(b);
    return (ai<0?99:ai)-(bi<0?99:bi) || a.localeCompare(b);
  });
  const names = new Intl.DisplayNames(['en'], {type:'currency'});
  $('currency').innerHTML = codes.map(code => `<option value="${code}" title="${escape(names.of(code))}">${code}</option>`).join('');
  let saved = 'USD';
  try { saved = localStorage.getItem('minerodds-currency') || 'USD'; } catch {}
  setCurrency(codes.includes(saved) ? saved : 'USD');
  if (!codes.includes(saved)) $('currency-status').textContent = `USD \u00b7 ${/^[A-Z]{3}$/.test(saved)?saved:'Saved currency'} rate unavailable`;
}

function renderDetail() {
  const coin = state.coins.find(c => c.symbol === state.selected);
  $('detail').hidden = !coin;
  if (!coin) return;
  const stats = estimate(coin, defaultsFromInputs());
  const fields = [['Network difficulty',coin.difficulty ? fmt(coin.difficulty,2) : 'Unavailable'],['Network hashrate',`${hash(coin.network_hashrate)}${coin.hashrate_estimated ? ' (estimated)' : ''}`],['Observed block reward',coin.reward ? `${quantity(coin.reward)} ${coin.symbol}` : 'Unavailable'],['Block value (before pool fees)',coin.reward && coin.price ? money(coin.reward*coin.price) : 'Unavailable'],['Coin price',coin.price ? money(coin.price) : 'Unavailable'],['Mean wait for 1 block',state.valid ? wait(stats.wait) : '\u2014'],['Time to 50% chance',state.valid ? wait(stats.wait*Math.LN2) : '\u2014'],['Network retrieved',date(coin.network_updated)],['Price retrieved',date(coin.price_updated)],['Reward retrieved',date(coin.reward_updated)],['24h trading volume',coin.volume_usd ? money(coin.volume_usd) : 'Unavailable']];
  $('detail').innerHTML = `<div class="detail-header"><div><h2>${escape(coin.name)} <span class="dim">/ ${coin.symbol}</span></h2><p>${escape(coin.note)}</p></div><button class="icon-button" id="close-detail" aria-label="Close coin details" title="Close details"><i data-lucide="x"></i></button></div><div class="detail-content"><div><div class="chart"><canvas id="chance-chart" role="img" aria-label="Probability of at least one ${coin.symbol} block over one year"></canvas></div><p class="detail-note">${state.mode === 'pool' ? 'Pool estimates assume proportional rewards at the entered fee. Payout schemes, minimum payouts, rejected shares, orphan blocks and hardware costs are not included. ' : ''}Chance of at least one valid block, assuming constant difficulty and independent hashes. ${coin.stale ? 'Network data is stale. ' : ''}${coin.price_stale ? 'Current price data is unavailable or stale. ' : ''}${coin.reward_stale ? 'Current reward data is unavailable or stale. ' : ''}Source retrieval times do not guarantee the upstream data is current.</p></div><dl class="detail-stats">${fields.map(([label,value]) => `<div><dt>${label}</dt><dd>${escape(value)}</dd></div>`).join('')}</dl></div><div class="detail-sources">${[['network_source','Network source'],['reward_source','Reward source'],['price_source','Price source']].filter(([key])=>coin[key]).map(([key,label]) => `<a href="${escape(coin[key])}" target="_blank" rel="noopener">${label} \u2197</a>`).join('')}</div>`;
  drawChart(stats);
}

function drawChart(stats) {
  const canvas = $('chance-chart');
  if (!canvas) return;
  const {width,height} = canvas.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
  canvas.width = width*dpr; canvas.height = height*dpr;
  const ctx = canvas.getContext('2d'); ctx.scale(dpr,dpr);
  const colors = getComputedStyle(document.documentElement);
  const pad = {left:53,right:14,top:16,bottom:28}, w=width-pad.left-pad.right, h=height-pad.top-pad.bottom;
  const max = state.valid && stats.year > 0 ? Math.min(100, stats.year*1.15) : 100;
  ctx.font='10px system-ui';ctx.lineWidth=1;
  for(let i=0;i<=4;i++) { const y=pad.top+h*i/4; ctx.strokeStyle=colors.getPropertyValue('--line');ctx.beginPath();ctx.moveTo(pad.left,y);ctx.lineTo(width-pad.right,y);ctx.stroke();ctx.fillStyle=colors.getPropertyValue('--muted');ctx.textAlign='right';ctx.fillText(max===100 ? `${fmt(max*(1-i/4))}%` : pct(max*(1-i/4)),pad.left-8,y+3); }
  ctx.textAlign='center'; for(const month of [0,3,6,9,12])ctx.fillText(month===0?'Today':`${month} mo`,pad.left+w*month/12,height-6);
  if(stats.rate===null || !state.valid){ctx.fillText('No calculation available',width/2,height/2);return;}
  ctx.strokeStyle=colors.getPropertyValue('--green');ctx.lineWidth=2;ctx.beginPath();
  for(let i=0;i<=120;i++){const x=pad.left+w*i/120,y=pad.top+h*(1-(-Math.expm1(-stats.rate*YEAR*i/120)*100)/max);if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);}ctx.stroke();
}

$('settings').addEventListener('submit', event => event.preventDefault());
$('settings').addEventListener('input', render);
document.querySelectorAll('[data-hash]').forEach(button => button.addEventListener('click', () => {$('hashrate').value=button.dataset.hash;render();}));
$('search').addEventListener('input', render);
$('currency').addEventListener('change',()=>{
  setCurrency($('currency').value);
  try { localStorage.setItem('minerodds-currency',state.currency); } catch {}
  render();
});
$('table-head').addEventListener('click', event => {
  const button = event.target.closest('[data-sort]');if(!button)return;
  const key=button.dataset.sort;
  state.descending=key===state.sort?!state.descending:!['name','wait'].includes(key);
  state.sort=key;render();
});
$('table-body').addEventListener('click',event=>{if(event.target.closest('#retry')){location.reload();return;}const button=event.target.closest('[data-coin]');if(!button)return;state.selected=state.selected===button.dataset.coin?null:button.dataset.coin;render();});
$('detail').addEventListener('click',event=>{if(event.target.closest('#close-detail')){state.selected=null;render();}});
for(const mode of ['solo','pool']) $(mode+'-tab').addEventListener('click',()=>{
  state.mode=mode;state.sort=mode==='solo'?'year':'profit';state.descending=true;
  for(const tab of ['solo','pool']) $(tab+'-tab').setAttribute('aria-selected',String(tab===mode));
  $('results').setAttribute('aria-labelledby',mode+'-tab');
  document.querySelectorAll('.pool-input').forEach(input=>input.hidden=mode!=='pool');render();
});
document.querySelector('.tabs').addEventListener('keydown',event=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(event.key)){event.preventDefault();const target=event.key==='Home'?'solo':event.key==='End'?'pool':state.mode==='solo'?'pool':'solo';$(target+'-tab').click();$(target+'-tab').focus();}});
function themeLabel(){const dark=document.documentElement.dataset.theme==='dark';$('theme').innerHTML=`<i data-lucide="${dark?'sun':'moon'}"></i>`;$('theme').setAttribute('aria-label',`Switch to ${dark?'light':'dark'} theme`);icons();}
$('theme').addEventListener('click',()=>{document.documentElement.dataset.theme=document.documentElement.dataset.theme==='dark'?'light':'dark';try{localStorage.setItem('minerodds-theme',document.documentElement.dataset.theme);}catch{}themeLabel();renderDetail();icons();});
$('export').addEventListener('click',()=>{
  const data=rows();const keys=state.mode==='solo'?['symbol','name','currency','fxRate','fxDate','difficulty','day','week','month','year','wait','reward','price','blockValue','network_updated','price_updated']:['symbol','name','currency','fxRate','fxDate','yieldDay','revenue','electricity','profit','netMonth','netYear','blockValue','network_updated','price_updated'];
  const monetary = new Set(['price','blockValue','revenue','electricity','profit','netMonth','netYear']);
  const csv=[keys,...data.map(coin=>keys.map(key=>key==='currency'?state.currency:key==='fxRate'?exchangeRate():key==='fxDate'?state.exchange.dates[state.currency]||'':coin[key]===null||coin[key]===undefined?'':monetary.has(key)?coin[key]*exchangeRate():coin[key]))].map(row=>row.map(value=>`"${String(value).replaceAll('"','""')}"`).join(',')).join('\r\n');
  const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download=`minerodds-${state.mode}-${state.currency}-${new Date().toISOString().slice(0,10)}.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
});
window.addEventListener('resize',()=>{const coin=state.coins.find(c=>c.symbol===state.selected);if(coin)drawChart(estimate(coin,defaultsFromInputs()));});
themeLabel();
try {
  const response=await fetch('api/coins.php');if(!response.ok)throw new Error('API unavailable');
  const snapshot=await response.json();if(!Array.isArray(snapshot.coins))throw new Error('Invalid snapshot');
  state.snapshot=snapshot;state.coins=snapshot.coins;
  initializeCurrencies(snapshot.exchange);
  const count=state.coins.filter(c=>c.available&&!c.stale).length;
  $('data-status').innerHTML=`<span class="status-dot"></span>${count}/${state.coins.length} networks \u00b7 Retrieved ${date(snapshot.attempted_at)}`;
  $('data-status').title=`Next refresh eligible: ${date(snapshot.next_refresh)}. Reloading uses the local daily cache.`;
} catch {
  $('data-status').textContent='Data unavailable';
  $('table-body').innerHTML='<tr><td colspan="7" class="empty">Mining data is unavailable. <button id="retry">Try again</button></td></tr>';
}
render();
