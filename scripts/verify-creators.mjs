// Isolated API fixtures and browser storage; never sends a request to a live account service.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { chromium, expect } from '@playwright/test';

const base = process.env.CREATORS_UI_BASE ?? 'http://127.0.0.1:3001';
const browser = await chromium.launch({ channel:'msedge', headless:true });
const context = await browser.newContext({ viewport:{ width:390,height:844 }, isMobile:true, hasTouch:true, reducedMotion:'reduce' });
const page = await context.newPage();
page.setDefaultTimeout(20000);
const errors = [], reads = [], writes = [];
page.on('pageerror', error => errors.push(error.message));
const thumbnail = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="400" height="500"><defs><linearGradient id="g" x2="1" y2="1"><stop stop-color="#3a654d"/><stop offset="1" stop-color="#db966a"/></linearGradient></defs><rect width="400" height="500" fill="url(#g)"/><circle cx="200" cy="210" r="96" fill="#fff" opacity=".15"/><path d="M176 160L176 260L253 210Z" fill="#fff" opacity=".7"/></svg>')}`;
const creators = new Map([
  ['friend-a', { id:'friend-a', username:'Dreamer', bio:'Little moments from the Ambaverse.', avatarUrl:null, joinedAt:'2026-01-01T00:00:00Z', followerCount:5, friendCount:2, clipCount:18, following:false, friendState:null }],
  ['incoming-one', { id:'incoming-one', username:'Requester', bio:'', avatarUrl:null, joinedAt:null, followerCount:2, friendCount:1, clipCount:0, following:false, friendState:'incoming' }],
  ['test-user', { id:'test-user', username:'Tester', bio:'My video diary.', avatarUrl:null, joinedAt:'2026-02-01T00:00:00Z', followerCount:8, friendCount:3, clipCount:26, following:false, friendState:null }],
]);
const clips = id => Array.from({ length:creators.get(id).clipCount }, (_, index) => ({
  id:`${id}-clip-${index}`, title:`Clip ${index+1}`, description:'A moment worth keeping.', thumbnailUrl:thumbnail,
  status:id === 'test-user' && index === 0 ? 'Draft' : 'Published', playable:!(id === 'test-user' && index === 0),
  createdAt:'2026-10-01T00:00:00Z', upvotes:index+3, commentCount:2,
}));
let failAction = false, failSearch = false, failClips = false, failProfile = false;
await context.route('**/*', async route => {
  const request = route.request(), url = new URL(request.url()), path = url.pathname.replace(/\/$/,'');
  if ((url.hostname === '127.0.0.1' || url.hostname === 'localhost') && !path.startsWith('/api/public')) return route.continue();
  if (request.method() === 'OPTIONS') return route.fulfill({ status:204, headers:{ 'access-control-allow-origin':'*', 'access-control-allow-headers':'authorization, content-type', 'access-control-allow-methods':'GET, POST, PUT, OPTIONS' } });
  if (path.endsWith('/profile/initialize')) return route.fulfill({ json:{ username:creators.get('test-user').username, bio:creators.get('test-user').bio, birthDate:null } });
  if (path.endsWith('/profile/avatars')) return route.fulfill({ json:{ avatars:[] } });
  if (path.endsWith('/friends/summary')) return route.fulfill({ json:{ incomingCount:creators.get('incoming-one').friendState === 'incoming' ? 1 : 0 } });
  if (path.endsWith('/profile') && request.method() === 'PUT') {
    const body = request.postDataJSON();
    creators.get('test-user').username = body.username;
    creators.get('test-user').bio = body.bio;
    return route.fulfill({ json:{ ...body } });
  }
  if (path.endsWith('/creators/search')) {
    const q = url.searchParams.get('q').toLowerCase(), cursor = url.searchParams.get('cursor');
    reads.push({ type:'search',q,cursor });
    if (failSearch) { failSearch=false; return route.fulfill({ status:500,json:{} }); }
    if (q === 'slow') await new Promise(resolve => setTimeout(resolve,600));
    const results = q === 'dreamer@example.test' || q === 'dream' ? [creators.get('friend-a')] : q === 'many' ? Array.from({ length:22 }, (_,i) => ({ id:`result-${i}`,username:`Many${i}`,avatarUrl:null })) : [];
    const offset = cursor ? Number(cursor) : 0;
    return route.fulfill({ json:{ players:results.slice(offset,offset+15).map(({id,username,avatarUrl})=>({id,username,avatarUrl})), nextCursor:offset+15<results.length ? String(offset+15) : null } });
  }
  const match = path.match(/\/creators\/([^/]+)(?:\/(follow|clips))?$/);
  if (match) {
    const [,id,kind] = match;
    const profile = creators.get(id);
    if (!profile || (failProfile && !kind)) return route.fulfill({ status:404,json:{} });
    if (kind === 'follow') {
      const { action } = request.postDataJSON();
      if (failAction) { failAction=false; return route.fulfill({ status:409,json:{} }); }
      writes.push({ id,action });
      if (action === 'unfollow') {
        if (profile.following) profile.followerCount--;
        profile.following=false;
        if (profile.friendState === 'outgoing') profile.friendState=null;
      } else {
        if (!profile.following) profile.followerCount++;
        profile.following=true;
        if (action === 'accept') { profile.friendState='accepted'; profile.friendCount++; creators.get('test-user').friendCount++; }
        else if (!profile.friendState) profile.friendState='outgoing';
      }
    }
    if (kind === 'clips') {
      const cursor = url.searchParams.get('cursor'), offset = cursor ? Number(cursor) : 0;
      reads.push({ type:'clips',id,cursor });
      if (failClips) { failClips=false; return route.fulfill({ status:500,json:{} }); }
      const all = clips(id);
      return route.fulfill({ json:{ clips:all.slice(offset,offset+12), nextCursor:offset+12<all.length ? String(offset+12) : null } });
    }
    return route.fulfill({ json:{ ...profile } });
  }
  if (path.endsWith('/scroll') || path.includes('/scroll/friend-a-clip')) {
    const clip = { id:'friend-a-clip-0', title:'A Dreamy moment', description:'Little moments from the Ambaverse.', uploader:'Dreamer',uploaderId:'friend-a',uploaderAvatarUrl:null,videoUrl:'https://fixture.invalid/clip.mp4',thumbnailUrl:thumbnail,upvotes:3,downvotes:0,commentCount:2,userVote:0 };
    return route.fulfill({ json:path.endsWith('/scroll') ? { videos:[clip],nextCursor:null } : clip });
  }
  return route.fulfill({ json:{} });
});
await context.addInitScript(() => {
  if (!['localhost','127.0.0.1'].includes(location.hostname)) return;
  const payload = btoa(JSON.stringify({ sub:'test-user', email:'tester@example.test', name:'Tester' }));
  localStorage.setItem('ambatuapp-cognito-session', JSON.stringify({ idToken:`fixture.${payload}.fixture`,accessToken:'fixture',refreshToken:'fixture',expiresAt:Date.now()+3600000 }));
  localStorage.setItem('ambatuapp-locale','en');
  if (!localStorage.getItem('ambatuapp-theme')) localStorage.setItem('ambatuapp-theme','light');
  sessionStorage.setItem('ambatuapp-push-prompt-dismissed:test-user','1');
});
const count = (label) => page.locator('.creator-counts > div').filter({ has:page.getByText(label,{exact:true}) }).locator('dd');
const noOverflow = async () => assert(await page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth), 'Viewport must not overflow');
try {
  await fs.mkdir('../.tmp',{recursive:true});
  await page.goto(`${base}/scroll/`);
  const search = page.getByRole('searchbox',{name:'Search people'});
  await search.fill('dream');
  await page.locator('.creator-search-results').getByRole('link',{name:"View Dreamer's profile"}).waitFor();
  await search.fill('dreamer@example.test');
  await page.locator('.creator-search-results').getByRole('link',{name:"View Dreamer's profile"}).waitFor();
  assert(reads.some(read=>read.q==='dreamer@example.test'));
  await page.keyboard.press('Escape');
  await expect(page.locator('.creator-search-results')).toHaveCount(0);
  await search.fill('many');
  await expect(page.locator('.creator-search-result')).toHaveCount(15);
  await page.locator('.creator-search-results').evaluate(el=>el.scrollTo(0,el.scrollHeight));
  await expect(page.locator('.creator-search-result')).toHaveCount(22);
  failSearch=true;
  await search.fill('dream');
  await page.getByText('Could not search people. Try again.',{exact:true}).waitFor();
  await page.locator('.creator-search-results').getByRole('button',{name:'Retry',exact:true}).click();
  await page.locator('.creator-search-result').waitFor();
  await page.getByRole('button',{name:'Clear search'}).click();
  await noOverflow();
  await page.screenshot({path:'../.tmp/creators-scroll-mobile.png'});
  await page.locator('.scroll-uploader-avatar').click();
  await expect(page).toHaveURL(/\/scroll\/profile\/\?user=friend-a/);
  await page.getByRole('heading',{name:'Dreamer',exact:true}).waitFor();
  await expect(count('Followers')).toHaveText('5');
  await expect(count('Friends')).toHaveText('2');
  failAction=true;
  await page.getByRole('button',{name:'Follow',exact:true}).click();
  await page.getByText('Could not update this connection. Try again.',{exact:true}).waitFor();
  await expect(count('Followers')).toHaveText('5');
  await page.getByRole('button',{name:'Follow',exact:true}).click();
  await page.getByRole('button',{name:'Unfollow Dreamer',exact:true}).waitFor();
  await expect(count('Followers')).toHaveText('6');
  await page.getByText('Friend request sent',{exact:true}).waitFor();
  creators.get('friend-a').friendState=null;
  await page.reload();
  await page.getByRole('button',{name:'Unfollow Dreamer',exact:true}).waitFor();
  await expect(count('Followers')).toHaveText('6');
  assert.equal(await page.getByText('Friend request sent',{exact:true}).count(),0);
  await page.getByRole('button',{name:'Unfollow Dreamer',exact:true}).click();
  await expect(count('Followers')).toHaveText('5');
  await page.locator('.creator-sentinel').last().scrollIntoViewIfNeeded();
  await expect(page.locator('.creator-clip-card')).toHaveCount(18);
  assert(reads.some(read=>read.type==='clips' && read.id==='friend-a' && read.cursor==='12'));
  await page.locator('.creator-clip-card a').first().click();
  await page.getByRole('link',{name:'Back to profile',exact:true}).click();
  await page.getByRole('heading',{name:'Dreamer',exact:true}).waitFor();
  for (const width of [320,375,430,1440]) {
    await page.setViewportSize({width,height:900});
    await page.evaluate(()=>scrollTo(0,0));
    await noOverflow();
    await page.screenshot({path:`../.tmp/creators-profile-${width}.png`});
  }
  await page.evaluate(()=>{localStorage.setItem('ambatuapp-theme','dark');document.documentElement.dataset.theme='dark'});
  await page.setViewportSize({width:390,height:844});
  await page.screenshot({path:'../.tmp/creators-profile-dark.png'});
  await page.goto(`${base}/scroll/profile/?user=incoming-one`);
  await page.getByRole('button',{name:'Accept & follow',exact:true}).click();
  await expect(count('Friends')).toHaveText('2');
  await page.getByRole('button',{name:'Unfollow Requester'}).waitFor();
  await page.getByRole('button',{name:'Unfollow Requester'}).click();
  await expect(count('Friends')).toHaveText('2');
  await page.getByRole('link',{name:'Start chat',exact:true}).waitFor();
  await page.goto(`${base}/profile/`);
  await page.getByRole('heading',{name:'My uploaded clips',exact:true}).waitFor();
  await expect(count('Followers')).toHaveText('8');
  await expect(count('Friends')).toHaveText('4');
  assert.equal(await page.getByRole('button',{name:'Follow',exact:true}).count(),0);
  await page.getByText('Draft',{exact:true}).waitFor();
  for(let i=0;i<3 && await page.locator('.creator-clip-card').count()<26;i++) {
    await page.locator('.creator-sentinel').last().scrollIntoViewIfNeeded();
    await expect.poll(()=>page.locator('.creator-clip-card').count()).toBeGreaterThan((i+1)*12);
  }
  await expect(page.locator('.creator-clip-card')).toHaveCount(26);
  await page.locator('.creator-bio-input').fill('My new creator bio.');
  await page.locator('.profile-save-button').click();
  await expect(page.locator('.creator-bio')).toHaveText('My new creator bio.');
  await page.evaluate(()=>{localStorage.setItem('ambatuapp-theme','light');document.documentElement.dataset.theme='light';scrollTo(0,0)});
  for(const width of [320,390,1440]) {
    await page.setViewportSize({width,height:900});
    await noOverflow();
    await page.screenshot({path:`../.tmp/creators-mydreamy-${width}.png`});
  }
  await page.getByRole('button',{name:'Share my profile',exact:true}).click();
  const dialog = page.getByRole('dialog');
  await dialog.waitFor();
  assert((await dialog.locator('input').inputValue()).includes('/scroll/profile/?user=test-user'));
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  failClips=true;
  await page.goto(`${base}/scroll/profile/?user=friend-a`);
  await page.getByText('Could not load uploaded clips.',{exact:true}).waitFor();
  await page.locator('.creator-clips-section').getByRole('button',{name:'Retry',exact:true}).click();
  await expect.poll(()=>page.locator('.creator-clip-card').count()).toBeGreaterThan(0);
  failProfile=true;
  await page.reload();
  await page.getByText('Could not load this profile. It may no longer be available.',{exact:true}).waitFor();
  failProfile=false;
  await page.getByRole('button',{name:'Retry',exact:true}).click();
  await page.getByRole('heading',{name:'Dreamer',exact:true}).waitFor();
  assert.equal(errors.length,0,errors.join('\n'));
  console.log(JSON.stringify({ passed:true, checks:'username/email search, result and clip cursors, avatar navigation, follow failure/retry, declined follower retention, accept/follow, unfriend independence, MyDreamy uploads/bio/sharing, mobile/desktop/dark, error retries', mutations:writes.length, apiReads:reads.length }));
} finally { await browser.close(); }
