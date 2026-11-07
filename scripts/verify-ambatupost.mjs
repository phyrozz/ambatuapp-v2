// Intercepted APIs only; no live account, Dream, message or media is created.
import { chromium, expect } from '@playwright/test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
const base=process.env.DREAM_UI_BASE??'http://127.0.0.1:3118';
const en=JSON.parse(await fs.readFile('src/messages/en.json','utf8'));
const browser=await chromium.launch({channel:'msedge',headless:true});
try {
  const records=new Map(), calls=[], errors=[];
  const make=(text,extra={})=>({id:randomUUID(),authorId:'alice',authorName:'Alice',text,audience:'public',publication:'published',revision:1,createdAt:'2026-11-07T00:00:00.000Z',updatedAt:'2026-11-07T00:00:00.000Z',publishedAt:'2026-11-07T00:00:00.000Z',...extra});
  const publicDream=make('<img src=x onerror="window.injected=true"> A public Dream');records.set(publicDream.id,publicDream);
  for(let i=0;i<15;i++){const d=make(`History item ${i}`);records.set(d.id,d);}
  let conflict=false, moduleEnabled=true;
  async function contextFor(viewer,width=390){
    const context=await browser.newContext({viewport:{width,height:844},reducedMotion:'reduce'});
    await context.addInitScript(viewer=>{
      if(!['localhost','127.0.0.1'].includes(location.hostname))return;
      localStorage.setItem('ambatuapp-locale','en');
      if(viewer){const payload=btoa(JSON.stringify({sub:viewer,email:`${viewer}@example.invalid`,name:viewer==='alice'?'Alice':'Bob'}));localStorage.setItem('ambatuapp-cognito-session',JSON.stringify({idToken:`fixture.${payload}.fixture`,accessToken:'fixture',refreshToken:'fixture',expiresAt:Date.now()+3600000}));sessionStorage.setItem(`ambatuapp-push-prompt-dismissed:${viewer}`,'1');}
    },viewer);
    await context.route('**/*',async route=>{
      const r=route.request(),u=new URL(r.url()),p=u.pathname;
      if(r.method()==='OPTIONS')return route.fulfill({status:204,headers:{'access-control-allow-origin':'*','access-control-allow-headers':'authorization,content-type,idempotency-key','access-control-allow-methods':'GET,POST,PATCH,DELETE'}});
      if(p.endsWith('/profile/initialize'))return route.fulfill({json:{username:viewer==='alice'?'Alice':'Bob'}});
      if(p.endsWith('/friends/summary'))return route.fulfill({json:{incomingCount:0}});
      if(p.includes('/api/public/ambatupost')){
        const token=r.headers().authorization??null;
        calls.push({path:p,search:u.search,method:r.method(),token,key:r.headers()['idempotency-key']});
        if(!moduleEnabled)return route.fulfill({status:404,json:{error:'MODULE_UNAVAILABLE'}});
        if(p.endsWith('/config'))return route.fulfill({json:{available:true,textLimit:2000,attachmentsEnabled:false}});
        if(p.endsWith('/mine')){const owned=[...records.values()].filter(d=>d.authorId===viewer);const start=u.searchParams.has('cursor')?12:0;return route.fulfill({json:{dreams:owned.slice(start,start+12),nextCursor:start===0&&owned.length>12?'page-two':null}});}
        if(p.endsWith('/ambatupost')&&r.method()==='POST'){
          const body=r.postDataJSON();assert(token);assert(r.headers()['idempotency-key']);
          const d=make(body.text,{audience:body.audience,publication:body.publish?'published':'draft'});records.set(d.id,d);return route.fulfill({status:201,json:d});
        }
        const id=p.split('/').at(-1),d=records.get(id);
        if(!d||viewer==='bob'||(!viewer&&(d.audience!=='public'||d.publication!=='published')))return route.fulfill({status:404,json:{error:'DREAM_UNAVAILABLE'}});
        if(r.method()==='PATCH'){
          if(conflict){conflict=false;d.revision++;return route.fulfill({status:409,json:{error:'REVISION_CONFLICT'}});}
          Object.assign(d,r.postDataJSON(),{revision:d.revision+1,publication:r.postDataJSON().publish?'published':'draft'});return route.fulfill({json:d});
        }
        if(r.method()==='DELETE'){records.delete(id);return route.fulfill({status:204});}
        return route.fulfill({json:d});
      }
      if(u.origin===base)return route.continue();
      return route.fulfill({json:{}});
    });
    return context;
  }
  const owner=await contextFor('alice'),page=await owner.newPage();page.on('pageerror',error=>errors.push(error.message));
  await page.goto(`${base}/ambatupost/`);
  const body=page.getByRole('textbox',{name:en['post.body']});
  await expect(body).toBeVisible();
  await expect(page.getByLabel(en['post.audience'],{exact:true})).toHaveValue('public');
  await body.fill(String.fromCodePoint(0x1f600).repeat(2000));
  await expect(page.getByText(en['post.characters'].replace('{count}','2000').replace('{limit}','2000'))).toBeVisible();
  await expect(page.getByRole('button',{name:en['post.publish'],exact:true})).toBeEnabled();
  await body.fill('x'.repeat(2001));
  await expect(page.getByRole('button',{name:en['post.publish'],exact:true})).toBeDisabled();
  await body.fill('A new draft Dream');
  await page.getByLabel(en['post.audience'],{exact:true}).selectOption('friends');
  await page.getByRole('button',{name:en['post.saveDraft'],exact:true}).click();
  await expect(page.locator('.dream-text')).toHaveText('A new draft Dream');
  await expect(page.getByText(en['post.draftHelp'],{exact:true})).toBeVisible();
  await page.getByRole('button',{name:en['post.edit'],exact:true}).click();
  await page.getByRole('button',{name:en['post.publish'],exact:true}).click();
  await expect(page.locator('.dream-text')).toHaveText('A new draft Dream');
  await expect(page.getByText(en['post.draftHelp'],{exact:true})).toHaveCount(0);
  const createdId=new URL(page.url()).searchParams.get('dream');
  assert.equal(records.get(createdId).publication,'published');
  conflict=true;
  await page.getByRole('button',{name:en['post.edit'],exact:true}).click();
  await body.fill('Keep this edit on a conflict');
  await page.getByRole('button',{name:en['post.saveChanges'],exact:true}).click();
  await expect(page.locator('.dream-notice[role="alert"]')).toContainText(en['post.conflict']);
  await expect(body).toHaveValue('Keep this edit on a conflict');
  await page.getByRole('button',{name:en['post.reload'],exact:true}).click();
  await expect(page.locator('.dream-text')).toHaveText('A new draft Dream');
  await page.getByRole('button',{name:en['post.delete'],exact:true}).click();
  const dialog=page.getByRole('dialog',{name:en['post.deleteTitle']});
  await expect(dialog).toBeVisible();await page.keyboard.press('Escape');await expect(dialog).toHaveCount(0);
  await page.getByRole('button',{name:en['post.delete'],exact:true}).click();
  await page.getByRole('dialog',{name:en['post.deleteTitle']}).getByRole('button',{name:en['post.delete'],exact:true}).click();
  await expect(body).toBeVisible();assert(!records.has(createdId));
  await page.evaluate(()=>scrollTo(0,document.body.scrollHeight));
  await expect.poll(()=>calls.some(c=>c.search.includes('cursor=page-two'))).toBe(true);
  await expect(page.locator('.dream-history-card')).toHaveCount(16);
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.evaluate(()=>scrollTo(0,0));
  await page.screenshot({path:'../.tmp/ambatupost-mobile.png'});
  await page.setViewportSize({width:1440,height:1000});await page.screenshot({path:'../.tmp/ambatupost-desktop.png'});
  await page.evaluate(()=>{document.documentElement.dataset.theme='dark';});await page.screenshot({path:'../.tmp/ambatupost-dark.png'});
  const guest=await contextFor(null),guestPage=await guest.newPage();guestPage.on('pageerror',error=>errors.push(error.message));
  await guestPage.goto(`${base}/ambatupost/?dream=${publicDream.id}`);
  await expect(guestPage.locator('.dream-text')).toHaveText(publicDream.text);
  await expect(guestPage.locator('.dream-text img')).toHaveCount(0);assert.equal(await guestPage.evaluate(()=>Boolean(window.injected)),false);
  await expect(guestPage.getByRole('button',{name:en['post.edit'],exact:true})).toHaveCount(0);
  await expect(guestPage.getByText(en['post.signIn'],{exact:true})).toBeVisible();
  const blocked=await contextFor('bob'),blockedPage=await blocked.newPage();
  await blockedPage.goto(`${base}/ambatupost/?dream=${publicDream.id}`);
  await expect(blockedPage.locator('.dream-notice[role="alert"]')).toContainText(en['post.unavailable']);
  await expect(blockedPage.locator('.dream-text')).toHaveCount(0);
  assert(calls.filter(c=>c.path.endsWith(publicDream.id)).some(c=>c.token===null));
  assert(calls.filter(c=>c.path.endsWith(publicDream.id)).some(c=>c.token?.startsWith('Bearer ')));
  moduleEnabled=false;await guestPage.reload();
  await expect(guestPage.locator('.dream-notice[role="alert"]')).toContainText(en['post.disabled']);
  assert.deepEqual(errors,[]);
  console.log('Passed text creation/drafts, publishing, revision conflicts, deletion, Unicode limits, infinite history, guest/blocked views, escaping and responsive fixtures.');
}finally{await browser.close();}
