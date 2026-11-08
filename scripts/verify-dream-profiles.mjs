// Intercepted local fixtures only. No live accounts, posts, uploads, scores or messages.
import {chromium,expect as baseExpect} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const base=process.env.DREAM_UI_BASE??'http://localhost:3001',en=JSON.parse(await fs.readFile('src/messages/en.json','utf8'));
const expect=baseExpect.configure({timeout:30000}),browser=await chromium.launch({channel:'msedge',headless:true});
const id='c74a7d49-ed8c-4666-819d-91def00b08d1',mine='c74a7d49-ed8c-4666-819d-91def00b08d2',published='c74a7d49-ed8c-4666-819d-91def00b08d3',attachment='c74a7d49-ed8c-4666-819d-91def00b08d4';
try {
  for(const member of [true,false]) {
    const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
    await context.addInitScript(({member})=>{
      localStorage.setItem('ambatuapp-locale','en');localStorage.setItem('ambatuapp-mydreamy-tour:alice','completed');
      if(member){const payload=btoa(JSON.stringify({sub:'alice',email:'alice@example.invalid',name:'Alice'}));localStorage.setItem('ambatuapp-cognito-session',JSON.stringify({idToken:`fixture.${payload}.fixture`,accessToken:'fixture',refreshToken:'fixture',expiresAt:Date.now()+3600000}));sessionStorage.setItem('ambatuapp-push-prompt-dismissed:alice','1');}
    },{member});
    const page=await context.newPage(),errors=[],calls=[];let deny=false;
    page.on('pageerror',error=>errors.push(error.message));
    const avatar=`${base}/fixture-avatar.svg`;
    const profile=(user)=>({id:user,username:user==='bob'?'Bob':'Alice',avatarUrl:avatar,bio:'Profile fixture',joinedAt:'2026-01-01T00:00:00Z',followerCount:2,friendCount:1,clipCount:1,following:false,friendState:member&&user==='bob'?'accepted':null});
    const dream=(dreamId,author,publication='published',audience='public')=>({id:dreamId,authorId:author,authorName:author==='bob'?'Bob':'Alice',authorAvatarUrl:avatar,text:publication==='draft'?'Private draft fixture':'Public Dream fixture',audience,publication,revision:1,attachments:[],createdAt:'2026-11-08T00:00:00Z',updatedAt:'2026-11-08T00:00:00Z',publishedAt:publication==='published'?'2026-11-08T00:00:00Z':null,votes:{up:0,down:0,viewerVote:0}});
    await context.route('**/*',async route=>{
      const request=route.request(),url=new URL(request.url()),path=url.pathname;
      if(path==='/fixture-avatar.svg')return route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><rect width="80" height="80" fill="#bf6249"/><circle cx="40" cy="40" r="20" fill="#ffe3ae"/></svg>'});
      if(path.endsWith('/profile/initialize'))return route.fulfill({json:{username:'Alice',birthDate:'2000-01-01',bio:'Owner bio',avatarUrl:avatar}});
      if(path.endsWith('/profile/avatars'))return route.fulfill({json:{avatars:[]}});
      if(path.endsWith('/friends/summary'))return route.fulfill({json:{incomingCount:0}});
      if(path.includes('/api/public/creators/')) {
        calls.push({path,hasAuth:Boolean(request.headers().authorization)});
        if(deny)return route.fulfill({status:404,json:{error:'PLAYER_NOT_FOUND'}});
        const parts=path.split('/').filter(Boolean),index=parts.indexOf('creators'),owner=parts[index+1],kind=parts[index+2];
        if(!kind)return route.fulfill({json:profile(owner)});
        if(kind==='dreams')return route.fulfill({json:{dreams:[dream(id,'bob')],nextCursor:null}});
        if(kind==='clips')return route.fulfill({json:{clips:[{id:'fixture-clip',title:'Published video fixture',description:'',thumbnailUrl:avatar,status:'Published',playable:true,createdAt:'2026-11-08T00:00:00Z',upvotes:2,commentCount:0}],nextCursor:null}});
        if(kind==='lores')return route.fulfill({json:{lores:[{id:'fixture-lore',title:'Published lore fixture',excerpt:'Lore preview',createdAt:null}],nextCursor:null}});
        if(kind==='scores')return route.fulfill({json:{scores:[{gameId:'ambatutap',score:123}]}});
      }
      if(path.includes('/api/public/ambatupost')) {
        if(path.endsWith('/config'))return route.fulfill({json:{attachmentsEnabled:true}});
        if(path.endsWith('/feed'))return route.fulfill({json:{dreams:[dream(id,'bob')],nextCursor:null}});
        if(path.endsWith('/mine'))return route.fulfill({json:{dreams:[dream(mine,'alice','draft','only_me'),{...dream(published,'alice'),attachments:[{id:attachment,kind:'image',state:'ready',bytes:500,width:80,height:80,duration:null,error:null}],votes:{up:4,down:1,viewerVote:0}}],nextCursor:null}});
        if(path.endsWith('/media-session'))return route.fulfill({json:{token:'fixture',expiresIn:300,media:[{id:attachment,url:avatar,thumbnail:avatar}]}});
        return route.fulfill({json:dream(id,'bob')});
      }
      if(url.origin===base)return route.continue();
      return route.fulfill({json:{}});
    });
    await page.goto(`${base}/ambatupost/`);
    await expect(page.locator('.dream-feed-card')).toHaveCount(1);
    await expect(page.locator('.dream-hero-mark')).toHaveCount(0);
    await expect(page.locator('.dream-history')).toHaveCount(0);
    await expect(page.locator('.dream-start-input')).toHaveText(en['post.placeholder']);
    await expect(page.locator('.dream-feed-card .dream-author-mark img')).toHaveAttribute('src',avatar);
    await page.screenshot({path:`../.tmp/dream-profile-feed-${member?'member':'guest'}.png`});
    await page.locator('.dream-feed-card .dream-detail-header').getByRole('link',{name:en['creator.view'].replace('{name}','Bob')}).click();
    await expect(page.locator('.creator-hero h1')).toHaveText('Bob');
    await expect(page.locator('.creator-avatar img')).toHaveAttribute('src',avatar);
    await expect(page.getByRole('link',{name:en['post.back'],exact:true})).toHaveAttribute('href','/ambatupost/');
    await expect(page.locator('.creator-dreams')).toContainText('Public Dream fixture');
    const tabs=page.locator('.creator-content-tabs');
    await expect(tabs.getByRole('tab')).toHaveCount(4);
    await expect(tabs.getByRole('tab').nth(0)).toHaveText(en['creator.tabDreams']);
    await expect(tabs.getByRole('tab').nth(1)).toHaveText(en['profile.tabVideos']);
    await tabs.getByRole('tab',{name:en['profile.tabVideos']}).click();
    await expect(page.locator('.creator-clip-card')).toContainText('Published video fixture');
    await expect(page.locator('.creator-clip-card a[href^="/scroll/"]')).toHaveCount(1);
    await expect(page.locator('.creator-clip-card a[href^="/watch/"]')).toHaveCount(1);
    await tabs.getByRole('tab',{name:en['profile.tabLore']}).click();
    await expect(page.locator('.creator-lore-card a')).toHaveText('Published lore fixture');
    await expect(page.locator('.creator-lore-card a')).toHaveAttribute('href','/lores/fixture-lore/');
    await tabs.getByRole('tab',{name:en['creator.tabScores']}).click();
    await expect(page.locator('.creator-scores')).toContainText(en['creator.scoresHint']);
    await expect(page.locator('.creator-score-card')).toContainText('123');
    await expect(page.locator('.creator-score-card')).toContainText(en['game.ambatutap.name']);
    assert(calls.filter(call=>/\/(dreams|clips|lores|scores)$/.test(call.path)).every(call=>call.hasAuth===member));
    await page.setViewportSize({width:320,height:850});
    await page.evaluate(()=>{localStorage.setItem('ambatuapp-theme','dark');document.documentElement.setAttribute('data-theme','dark');});
    await expect.poll(()=>tabs.evaluate(node=>{const bounds=node.getBoundingClientRect(),selected=node.querySelector('[aria-selected="true"]').getBoundingClientRect();return selected.left>=bounds.left-1&&selected.right<=bounds.right+1;})).toBe(true);
    await page.screenshot({path:`../.tmp/dream-profile-${member?'member':'guest'}-phone-dark.png`});
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth));
    if(member) {
      deny=true;
      await tabs.getByRole('tab',{name:en['profile.tabLore']}).click();
      await expect(page.locator('.creator-hero')).toHaveCount(0);
      deny=false;
      await page.goto(`${base}/profile/#my-dreams`);
      await expect(page.getByRole('tab',{name:en['creator.tabDreams'],exact:true})).toHaveAttribute('aria-selected','true');
      const myTabs=page.locator('#dreamy-tabs').getByRole('tab');
      await expect(myTabs.nth(0)).toHaveText(en['creator.tabDreams']);
      await expect(myTabs.nth(1)).toHaveText(en['profile.tabVideos']);
      await expect(page.locator('#my-dreams')).toContainText('Private draft fixture');
      await expect(page.locator('#my-dreams')).toContainText(en['post.draft']);
      const ownCards=page.locator('#my-dreams .dream-feed-card');
      await expect(ownCards).toHaveCount(2);
      await expect(ownCards.first().locator('.dream-votes')).toHaveCount(0);
      await ownCards.nth(1).scrollIntoViewIfNeeded();
      await expect(ownCards.nth(1).locator('.dream-media-image')).toHaveAttribute('src',avatar);
      await expect(ownCards.nth(1).locator('.dream-vote strong')).toHaveText(['4','1']);
      await expect(page.locator('#my-dreams a[href*="dream="]')).toHaveCount(0);
      await page.screenshot({path:'../.tmp/mydreamy-dreams-phone-dark.png'});
      deny=true;
      await page.goto(`${base}/scroll/profile/?user=bob&from=post`);
      await expect(page.locator('.creator-error')).toContainText(en['creator.loadError']);
      await expect(page.locator('.creator-hero')).toHaveCount(0);
    } else {
      await expect(page.locator('.creator-actions').getByRole('button',{name:en['profile.googleSignIn']})).toBeVisible();
    }
    assert.deepEqual(errors,[]);
    await context.close();
  }
  console.log('Passed Dream author avatars/profile links, guest/member profiles, public Dreams/videos/lore/scores, MyDreamy draft history, blocked profiles and narrow dark layout.');
} finally {await browser.close();}
