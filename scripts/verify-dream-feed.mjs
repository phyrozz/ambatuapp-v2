// Local intercepted fixtures only: no live database, uploads, votes or chat sends.
import {chromium,expect as baseExpect} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createRequire} from 'node:module';
const sharp=createRequire(new URL('../../admin/dream-media/package.json',import.meta.url))('sharp');
const photo=await sharp(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="400" height="250"><rect width="400" height="250" fill="#efb58d"/><circle cx="300" cy="65" r="35" fill="#fff7da"/><path d="M0 200 150 50 300 250H0Z" fill="#5e7c6c"/></svg>')).jpeg().toBuffer();
const base=process.env.DREAM_UI_BASE??'http://localhost:3001',en=JSON.parse(await fs.readFile('src/messages/en.json','utf8'));
const browser=await chromium.launch({channel:'msedge',headless:true}),expect=baseExpect.configure({timeout:30000});
try {
  for(const member of [true,false]) {
    const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
    await context.addInitScript(({member})=>{
      localStorage.setItem('ambatuapp-locale','en');
      if(member){const payload=btoa(JSON.stringify({sub:'alice',email:'alice@example.invalid',name:'Alice'}));localStorage.setItem('ambatuapp-cognito-session',JSON.stringify({idToken:`fixture.${payload}.fixture`,accessToken:'fixture',refreshToken:'fixture',expiresAt:Date.now()+3600000}));sessionStorage.setItem('ambatuapp-push-prompt-dismissed:alice','1');}
    },{member});
    const page=await context.newPage(),errors=[],requests=[],sessions=[];let generation=0,fail=true,expire=false,active=0,maxActive=0,mineReads=0;
    const cards=new Map();
    const card=i=>{
      const id=`c74a7d49-ed8c-4666-819d-${String(generation*100+i).padStart(12,'0')}`;
      const attachments=[0,7].includes(i)?Array.from({length:8},(_,j)=>({id:`c74a7d49-ed8c-4666-819d-${String(10000+generation*100+i*10+j).padStart(12,'0')}`,kind:j===2?'video':'image',state:'ready',bytes:photo.length,width:400,height:250,duration:j===2?10:null,error:null})):[];
      const result={id,authorId:member&&i===0?'alice':`author-${i}`,authorName:i===0?'Alice':`Dreamer ${i}`,authorAvatarUrl:`${base}/fixture-feed-media/avatar`,text:`Round ${generation} Dream ${i}. A small moment worth sharing.`,audience:member&&i===0?'only_me':'public',publication:'published',revision:1,attachments,createdAt:'2026-11-08T00:00:00Z',updatedAt:'2026-11-08T00:00:00Z',publishedAt:'2026-11-08T00:00:00Z',votes:{up:i,down:0,viewerVote:0}};
      cards.set(id,result);return result;
    };
    page.on('pageerror',error=>errors.push(error.message));
    await context.route('**/*',async route=>{
      const request=route.request(),url=new URL(request.url()),path=url.pathname;
      if(path.endsWith('/profile/initialize'))return route.fulfill({json:{username:'Alice'}});
      if(path.endsWith('/friends/summary'))return route.fulfill({json:{incomingCount:0}});
      if(path.startsWith('/fixture-feed-media/'))return route.fulfill({headers:{'content-type':'image/jpeg','cache-control':'private, no-store'},body:photo});
      if(path.includes('/api/public/ambatupost')) {
        if(path.endsWith('/config'))return route.fulfill({json:{attachmentsEnabled:true}});
        if(path.endsWith('/mine')){mineReads++;return route.fulfill({json:{dreams:[],nextCursor:null}});}
        if(path.endsWith('/feed')) {
          assert.equal(Boolean(request.headers().authorization),member);
          active++;maxActive=Math.max(maxActive,active);const cursor=url.searchParams.get('cursor');requests.push(cursor);
          await new Promise(resolve=>setTimeout(resolve,80));active--;
          if(!cursor)return route.fulfill({json:{dreams:Array.from({length:8},(_,i)=>card(i)),nextCursor:'empty-page'}});
          if(expire)return route.fulfill({status:410,json:{error:'FEED_CURSOR_EXPIRED'}});
          if(cursor==='empty-page')return route.fulfill({json:{dreams:[],nextCursor:'last-page'}});
          assert.equal(cursor,'last-page');
          if(fail){fail=false;return route.fulfill({status:503,json:{error:'DREAM_SERVICE_UNAVAILABLE'}});}
          return route.fulfill({json:{dreams:[card(7),card(8),card(9),card(10)],nextCursor:null}});
        }
        const id=path.split('/').filter(Boolean).at(-1);
        if(path.endsWith('/media-session')) {
          const parent=path.split('/').at(-2);sessions.push(parent);
          return route.fulfill({json:{token:'fixture',expiresIn:300,media:cards.get(parent).attachments.map(a=>({id:a.id,url:`${base}/fixture-feed-media/${a.id}`,thumbnail:`${base}/fixture-feed-media/${a.id}?thumb=1`}))}});
        }
        if(request.method()==='DELETE'){cards.delete(id);return route.fulfill({status:204});}
        if(request.method()==='PATCH'){
          const updated={...cards.get(id),text:request.postDataJSON().text};cards.set(id,updated);
          return route.fulfill({json:updated});
        }
        return route.fulfill({json:cards.get(id)??{}});
      }
      if(url.origin===base)return route.continue();
      return route.fulfill({json:{}});
    });
    await page.goto(`${base}/ambatupost/`);
    await expect(page.locator('.dream-feed-card')).toHaveCount(8);
    await expect(page.locator('.dream-hero-mark')).toHaveCount(0);
    await expect(page.locator('.dream-history')).toHaveCount(0);
    await expect(page.locator('.dream-start-input')).toHaveText(en['post.placeholder']);
    await expect(page.locator('.dream-feed-card').first().locator('.dream-author-mark img')).toHaveAttribute('src',`${base}/fixture-feed-media/avatar`);
    await expect(page.locator('.dream-feed-card').first().locator('.dream-detail-header a').first()).toHaveAttribute('href',/\/scroll\/profile\/\?user=/);
    await expect(page.locator('.dream-feed-card a[href*="dream="]')).toHaveCount(0);
    await expect(page.getByRole('heading',{name:en['post.feed'],exact:true})).toBeVisible();
    await expect(page.locator('.dream-composer')).toHaveCount(0);
    await expect(page.locator('.dream-feed-card').first().locator('.dream-media-tile')).toHaveCount(5);
    await expect(page.locator('.dream-feed-card').first().locator('.dream-media-overflow')).toHaveText('+3');
    await expect(page.locator('.dream-feed-card').first().locator('.dream-vote span')).toHaveCount(0);
    await expect(page.locator('.dream-feed-card').first().locator('.dream-share')).toHaveText('');
    await expect.poll(()=>sessions.length).toBeGreaterThan(0);
    await expect.poll(()=>page.locator('.dream-feed-card').first().locator('img').evaluateAll(images=>images.some(image=>image.complete&&image.naturalWidth>0))).toBe(true);
    await expect(page.locator('.dream-feed-card').first().locator('.dream-media-image').first()).toHaveAttribute('data-ready','true');
    assert(!sessions.includes(card(7).id),'offscreen media does not acquire a session');
    assert.equal(requests.length,1,'no eager full-feed fetch');
    await page.screenshot({path:`../.tmp/dream-feed-${member?'member':'guest'}-desktop.png`,fullPage:false});
    if(member) {
      await page.getByRole('button',{name:en['post.create'],exact:true}).click();
      await expect(page.locator('.dream-composer')).toBeVisible();
      await page.getByRole('button',{name:en['post.cancel'],exact:true}).click();
      await expect(page.locator('.dream-composer')).toHaveCount(0);
    } else {
      await expect(page.locator('.dream-history')).toHaveCount(0);
      await expect(page.locator('.dream-detail-actions')).toHaveCount(0);
    }
    await page.locator('.dream-feed > .dream-sentinel').scrollIntoViewIfNeeded();
    await expect(page.locator('.dream-feed .dream-notice[role=alert]')).toContainText(en['post.error']);
    assert.deepEqual(requests,[null,'empty-page','last-page']);
    await page.locator('.dream-feed').getByRole('button',{name:en['common.retry'],exact:true}).click();
    await expect(page.locator('.dream-feed-card')).toHaveCount(11);
    await expect(page.locator('.dream-feed-end')).toHaveText(en['post.feedEnd']);
    assert.equal(maxActive,1,'feed requests never overlap');
    if(member) {
      await page.locator('.dream-feed-card').first().getByRole('button',{name:en['chat.moreActions'],exact:true}).click();
      await page.locator('.dream-feed-card').first().getByRole('button',{name:en['post.delete'],exact:true}).click();
      await page.getByRole('dialog').getByRole('button',{name:en['post.delete'],exact:true}).click();
      await expect(page.locator('.dream-feed-card')).toHaveCount(10);
      await expect(page.locator('.dream-feed > .dream-notice[role=status]')).toHaveText(en['post.deleted']);
      assert.equal(mineReads,0,'owner history belongs to MyDreamy');
    }
    generation++;expire=true;
    await page.locator('.dream-refresh').click();
    await expect(page.locator('.dream-feed-card')).toHaveCount(8);
    await expect(page.locator('.dream-feed-card').first()).toContainText('Round 1');
    await expect(page.locator('.dream-feed-card').first()).not.toContainText('Round 0');
    await page.locator('.dream-feed > .dream-sentinel').scrollIntoViewIfNeeded();
    await expect(page.locator('.dream-feed .dream-notice[role=alert]')).toContainText(en['post.feedExpired']);
    expire=false;generation++;
    await page.locator('.dream-feed .dream-notice[role=alert]').getByRole('button',{name:en['post.refreshFeed'],exact:true}).click();
    await expect(page.locator('.dream-feed-card').first()).toContainText('Round 2');
    await page.setViewportSize({width:320,height:850});
    await page.evaluate(()=>document.documentElement.setAttribute('data-theme','dark'));
    await page.locator('.dream-feed-card').first().scrollIntoViewIfNeeded();
    await page.screenshot({path:`../.tmp/dream-feed-${member?'member':'guest'}-phone-dark.png`,fullPage:false});
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth));
    await expect(page.locator('.dream-refresh')).toBeHidden();
    await page.evaluate(()=>window.scrollTo(0,0));
    const swipe=async(dx,dy)=>page.evaluate(({dx,dy})=>{
      const target=document.querySelector('.dream-page');
      const touch=(x,y)=>new Touch({identifier:1,target,clientX:x,clientY:y});
      const start=touch(100,120),end=touch(100+dx,120+dy);
      target.dispatchEvent(new TouchEvent('touchstart',{bubbles:true,cancelable:true,touches:[start],targetTouches:[start],changedTouches:[start]}));
      target.dispatchEvent(new TouchEvent('touchmove',{bubbles:true,cancelable:true,touches:[end],targetTouches:[end],changedTouches:[end]}));
      target.dispatchEvent(new TouchEvent('touchend',{bubbles:true,cancelable:true,touches:[],targetTouches:[],changedTouches:[end]}));
    },{dx,dy});
    const beforePull=requests.length;
    await swipe(80,20);
    await swipe(0,30);
    assert.equal(requests.length,beforePull,'short or horizontal gestures do not refresh');
    generation++;
    await swipe(0,100);
    await expect(page.locator('.dream-feed-card').first()).toContainText('Round 3');
    assert.equal(requests.length,beforePull+1,'pulling down at the top refreshes once');
    if(member) {
      await page.locator('.dream-feed-card').first().getByRole('button',{name:en['chat.moreActions'],exact:true}).click();
      await page.locator('.dream-feed-card').first().getByRole('button',{name:en['post.edit'],exact:true}).click();
      await expect(page.locator('.dream-composer textarea')).toHaveValue(/Round 3 Dream 0/);
      await page.locator('.dream-composer textarea').fill('Updated in dialog');
      await page.locator('.dream-composer').getByRole('button',{name:en['post.saveChanges'],exact:true}).click();
      await expect(page.locator('.dream-feed-card').first()).toContainText('Updated in dialog');
      assert(!new URL(page.url()).searchParams.has('dream'),'editing remains on the feed');
    }
    assert.deepEqual(errors,[]);
    await context.close();
  }
  console.log('Passed guest/member Dreamies, bounded infinite scrolling, empty continuation, retry/deduplication, expiry/refresh, lazy galleries, owner deletion/editing and narrow dark layouts.');
} finally {await browser.close();}
