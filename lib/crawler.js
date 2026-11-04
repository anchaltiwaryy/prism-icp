import dns from 'node:dns/promises';
import net from 'node:net';
import { load } from 'cheerio';
import robotsParser from 'robots-parser';
import { chromium } from 'playwright';

const agent = 'PRISMResearchBot/0.3 (+local evidence research)';
const blockedIp = address => {
  if (net.isIP(address) === 6) return !address.startsWith('2') && !address.startsWith('3');
  const parts = address.split('.').map(Number);
  return parts[0] === 0 || parts[0] === 10 || parts[0] === 127 || parts[0] >= 224 ||
    parts[0] === 169 && parts[1] === 254 || parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31 ||
    parts[0] === 192 && parts[1] === 168 || parts[0] === 100 && parts[1] >= 64 && parts[1] <= 127;
};
export async function publicUrl(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password || !url.hostname.includes('.')) return null;
    const addresses = await dns.lookup(url.hostname, {all:true});
    return addresses.length && addresses.every(item => !blockedIp(item.address)) ? url : null;
  } catch { return null; }
}
async function robotsAllowed(url) {
  try {
    const robotsUrl = new URL('/robots.txt', url);
    const response = await fetch(robotsUrl, {redirect:'manual', signal:AbortSignal.timeout(7000),headers:{'user-agent':agent}});
    if (response.status === 404) return true;
    if (!response.ok) return false;
    return robotsParser(robotsUrl.href, (await response.text()).slice(0,100000)).isAllowed(url.href, agent) !== false;
  } catch { return false; }
}
function extract(html, url, adapter) {
  const $ = load(html);
  $('script,style,noscript,nav,footer,svg,form').remove();
  const title = $('title').first().text().trim() || $('h1').first().text().trim() || url.hostname;
  const excerpt = $('main').first().text().replace(/\s+/g,' ').trim() || $('body').text().replace(/\s+/g,' ').trim();
  const links = $('a[href]').map((_, element) => {
    try { return new URL($(element).attr('href'),url).href; } catch { return null; }
  }).get().filter(Boolean);
  return {url:url.href,title:title.slice(0,200),excerpt:excerpt.slice(0,14000),links,adapter,origin:url.hostname,observed:new Date().toISOString()};
}
export async function crawlPage(value, {browser=false}={}) {
  const url = await publicUrl(value);
  if (!url || !await robotsAllowed(url)) return {status:'skipped',reason:'URL or robots policy',url:value};
  try {
    const response = await fetch(url,{redirect:'manual',signal:AbortSignal.timeout(12000),headers:{'user-agent':agent,accept:'text/html'}});
    if (response.ok && (response.headers.get('content-type')??'').includes('text/html')) {
      const html=(await response.text()).slice(0,250000);
      const page=extract(html,url,'HTTP + Cheerio');
      if (page.excerpt.length > 350 || !browser) return {status:'collected',page};
    }
  } catch { /* Browser rendering may recover a JavaScript page. */ }
  if (!browser) return {status:'skipped',reason:'Unavailable HTML',url:url.href};
  let instance;
  try {
    instance=await chromium.launch({headless:true});
    const context=await instance.newContext({userAgent:agent});
    await context.route('**/*',route => ['image','media','font','websocket'].includes(route.request().resourceType()) ? route.abort() : route.continue());
    const tab=await context.newPage();
    await tab.goto(url.href,{waitUntil:'domcontentloaded',timeout:15000});
    if (new URL(tab.url()).hostname !== url.hostname) return {status:'skipped',reason:'Cross-host redirect',url:url.href};
    const page=extract(await tab.content(),url,'Playwright + Cheerio');
    return page.excerpt ? {status:'collected',page} : {status:'skipped',reason:'Empty rendered page',url:url.href};
  } catch(error) { return {status:'skipped',reason:'Browser unavailable: '+error.message,url:url.href}; }
  finally { await instance?.close(); }
}
export async function discover(query, endpoint) {
  if (endpoint) {
    try {
      const url=new URL('/search',endpoint);url.searchParams.set('q',query);url.searchParams.set('format','json');
      const response=await fetch(url,{signal:AbortSignal.timeout(10000)});
      if(response.ok)return (await response.json()).results.slice(0,5).map(item=>item.url);
    } catch { /* Try public HTML search below. */ }
  }
  try {
    const url=new URL('https://html.duckduckgo.com/html/');url.searchParams.set('q',query);
    const response=await fetch(url,{signal:AbortSignal.timeout(10000),headers:{'user-agent':agent}});
    if(!response.ok)throw Error('Search unavailable');
    const $=load(await response.text());
    const found=$('.result__a').slice(0,5).map((_,item)=>{
      try {const link=new URL($(item).attr('href'),url);return link.hostname.endsWith('duckduckgo.com')?link.searchParams.get('uddg'):link.href;}catch{return null;}
    }).get().filter(Boolean);
    if(found.length)return found;
  } catch { /* Try the next search adapter. */ }
  try {
    const url=new URL('https://www.bing.com/search');url.searchParams.set('q',query);
    const response=await fetch(url,{signal:AbortSignal.timeout(10000),headers:{'user-agent':'Mozilla/5.0'}});
    if(!response.ok)return [];
    const $=load(await response.text());
    return $('.b_algo h2 a').slice(0,5).map((_,item)=>{
      try {const link=new URL($(item).attr('href'));const encoded=link.searchParams.get('u');return encoded?.startsWith('a1')?Buffer.from(encoded.slice(2),'base64url').toString('utf8'):link.href;}catch{return null;}
    }).get().filter(Boolean);
  } catch { return []; }
}


