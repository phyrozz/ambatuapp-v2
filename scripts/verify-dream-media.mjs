// Every API/storage request is intercepted. No live Dream, upload or message is created.
import {chromium,expect} from '@playwright/test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import fs from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
const sharp=createRequire(new URL('../../admin/dream-media/package.json',import.meta.url))('sharp');
const base=process.env.DREAM_UI_BASE??'http://localhost:3001',en=JSON.parse(await fs.readFile('src/messages/en.json','utf8'));
const photo=await sharp(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180"><rect width="320" height="180" fill="#d8b78c"/><circle cx="245" cy="47" r="24" fill="#f77846"/><path d="M0 145 95 45 190 150 260 90 320 150V180H0Z" fill="#655747"/><path d="M0 155 130 100 215 180H0Z" fill="#a47a50"/></svg>')).png().toBuffer();
const jpeg=await sharp(photo).jpeg().toBuffer();
const videoPath='../.tmp/dream-ui-video.mp4';
execFileSync('ffmpeg',['-y','-v','error','-f','lavfi','-i','color=c=orange:s=320x240:d=20','-c:v','libx264','-pix_fmt','yuv420p','-movflags','+faststart',videoPath],{windowsHide:true});
const deferred=()=>{let release;const promise=new Promise(resolve=>{release=resolve;});return {promise,release};};
let imageGate=deferred(),videoGate=deferred(),failImagePreview=false,failVideoPreview=false,failImage=false,denySessions=false;
const video=await fs.readFile(videoPath),browser=await chromium.launch({channel:'msedge',headless:true});
try{
  const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'}),page=await context.newPage();
  const uploads=new Map(),errors=[],sessions=[],thumbnailReads=new Map(),mediaReads=[];let dream=null,reads=0,operationReads=0;
  page.on('pageerror',error=>errors.push(error.message));
  await context.addInitScript(()=>{
    localStorage.setItem('ambatuapp-locale','en');
    const payload=btoa(JSON.stringify({sub:'alice',email:'alice@example.invalid',name:'Alice'}));
    localStorage.setItem('ambatuapp-cognito-session',JSON.stringify({idToken:`fixture.${payload}.fixture`,accessToken:'fixture',refreshToken:'fixture',expiresAt:Date.now()+3600000}));
    sessionStorage.setItem('ambatuapp-push-prompt-dismissed:alice','1');
  });
  await context.route('**/*',async route=>{
    const request=route.request(),url=new URL(request.url()),path=url.pathname,method=request.method();
    if(path.endsWith('/profile/initialize'))return route.fulfill({json:{username:'Alice'}});
    if(path.endsWith('/friends/summary'))return route.fulfill({json:{incomingCount:0}});
    if(path.startsWith('/fixture-upload/')){assert.equal(request.headers()['if-none-match'],'*');return route.fulfill({status:200,body:''});}
    if(path.startsWith('/fixture-media/')){
      assert(url.searchParams.has('grant'));const attachment=uploads.get(path.split('/')[2]);
      const thumbnail=url.searchParams.has('thumbnail');
      mediaReads.push({id:attachment.id,thumbnail});
      if(thumbnail)thumbnailReads.set(attachment.id,(thumbnailReads.get(attachment.id)??0)+1);
      if(thumbnail&&((attachment.kind==='image'&&failImagePreview)||(attachment.kind==='video'&&failVideoPreview)))return route.fulfill({status:404,body:''});
      if(!thumbnail&&attachment.kind==='image'){await imageGate.promise;if(failImage)return route.fulfill({status:403,body:''});}
      if(!thumbnail&&attachment.kind==='video')await videoGate.promise;
      const bytes=thumbnail||attachment.kind==='image'?jpeg:video;
      const range=request.headers().range?.match(/^bytes=(\d+)-(\d*)$/),start=range?Number(range[1]):0,end=range&&range[2]?Math.min(Number(range[2]),bytes.length-1):bytes.length-1;
      return route.fulfill({status:range?206:200,headers:{'content-type':attachment.kind==='image'||url.searchParams.has('thumbnail')?'image/jpeg':'video/mp4','accept-ranges':'bytes','cache-control':'private, no-store',...(range?{'content-range':`bytes ${start}-${end}/${bytes.length}`}:{})},body:bytes.subarray(start,end+1)});
    }
    if(path.includes('/api/public/ambatupost')){
      if(path.endsWith('/config'))return route.fulfill({json:{attachmentsEnabled:true}});
      if(path.endsWith('/mine'))return route.fulfill({json:{dreams:dream?[dream]:[],nextCursor:null}});
      if(path.endsWith('/feed'))return route.fulfill({json:{dreams:[],nextCursor:null}});
      if(path.includes('/operations/'))return route.fulfill({json:{state:++operationReads>1?'complete':'pending',error:operationReads===1?'MEDIA_CLEANUP_FAILED':null}});
      if(path.endsWith('/uploads')&&method==='POST'){
        const body=request.postDataJSON(),id=randomUUID();uploads.set(id,{id,kind:body.kind,state:'processing',bytes:body.bytes,width:320,height:180,duration:null,error:null});
        return route.fulfill({status:201,json:{id,uploadUrl:`${base}/fixture-upload/${id}`,uploadHeaders:{'content-type':body.contentType,'if-none-match':'*'}}});
      }
      if(path.includes('/uploads/'))return method==='DELETE'?route.fulfill({json:{removed:true}}):route.fulfill({json:uploads.get(path.split('/').at(-1))});
      if(path.endsWith('/media-session')){
        if(denySessions)return route.fulfill({status:403,json:{error:'DREAM_UNAVAILABLE'}});
        const body=request.postDataJSON(),token=body.token??'fixture-grant';sessions.push(token);
        return route.fulfill({json:{token,expiresIn:300,media:dream.attachments.filter(a=>a.state==='ready').map(a=>({id:a.id,url:`${base}/fixture-media/${a.id}?grant=${token}`,thumbnail:`${base}/fixture-media/${a.id}?grant=${token}&thumbnail=1`}))}});
      }
      if(method==='POST'){
        const body=request.postDataJSON();assert.equal(body.text,'');assert.equal(body.attachmentIds.length,2);assert(request.headers()['idempotency-key']);
        dream={id:randomUUID(),authorId:'alice',authorName:'Alice',text:'',audience:body.audience,publication:'processing',revision:1,attachments:body.attachmentIds.map(id=>uploads.get(id)),createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),publishedAt:null};
        return route.fulfill({status:201,json:dream});
      }
      if(method==='PATCH'){
        const body=request.postDataJSON();
        dream={...dream,text:body.text,audience:body.audience,revision:dream.revision+1,attachments:body.attachmentIds.map(id=>dream.attachments.find(item=>item.id===id))};
        return route.fulfill({json:dream});
      }
      if(method==='DELETE'){dream=null;return route.fulfill({status:202,json:{operationId:randomUUID(),state:'pending'}});}
      if(++reads>=2){dream={...dream,publication:'published',revision:2,attachments:dream.attachments.map(a=>({...a,state:'ready'}))};}
      return route.fulfill({json:dream});
    }
    if(url.origin===base)return route.continue();
    return route.fulfill({json:{}});
  });
  await page.clock.install();
  await page.goto(`${base}/ambatupost/`);
  await page.getByRole('button',{name:en['post.create'],exact:true}).click();
  const input=page.locator('input[type=file]');await expect(input).toBeAttached();
  await input.setInputFiles({name:'bad.svg',mimeType:'image/svg+xml',buffer:Buffer.from('<svg/>')});
  await expect(page.getByText(en['post.invalidAttachment'],{exact:true})).toBeVisible();
  await input.setInputFiles(Array.from({length:26},(_,index)=>({name:`image-${index}.png`,mimeType:'image/png',buffer:photo})));
  await expect(page.getByText(en['post.tooManyAttachments'],{exact:true})).toBeVisible();assert.equal(uploads.size,0);
  await input.setInputFiles([{name:'photo.png',mimeType:'image/png',buffer:photo},{name:'clip.mp4',mimeType:'video/mp4',buffer:video}]);
  await expect(page.locator('.dream-upload-list li')).toHaveCount(2);
  await expect(page.locator('.dream-upload-preview img')).toHaveCount(1);
  await expect(page.locator('.dream-upload-preview video')).toHaveCount(1);
  const privacy=page.getByRole('button',{name:en['post.audience'],exact:true});
  await privacy.click();
  await page.getByRole('option',{name:en['post.friends'],exact:true}).click();
  await expect(privacy).toContainText(en['post.friends']);
  await privacy.click();
  await page.getByRole('option',{name:en['post.public'],exact:true}).click();
  const rows=page.locator('.dream-upload-list li');
  const drag=rows.first().locator('.dream-reorder-handle');
  const from=await drag.boundingBox(),to=await rows.nth(1).boundingBox();
  await page.mouse.move(from.x+from.width/2,from.y+from.height/2);
  await page.mouse.down();
  await page.mouse.move(to.x+to.width/2,to.y+to.height/2,{steps:8});
  await page.mouse.up();
  await expect(rows.first().locator('video')).toHaveCount(1);
  await rows.nth(1).getByRole('button',{name:en['post.dragAttachment'].replace('{index}','2')}).focus();
  await page.keyboard.press('ArrowUp');
  await expect(rows.first().locator('img')).toHaveCount(1);
  await page.setViewportSize({width:390,height:844});
  await rows.nth(1).scrollIntoViewIfNeeded();
  const cdp=await context.newCDPSession(page);
  await cdp.send('Emulation.setTouchEmulationEnabled',{enabled:true});
  const touchFrom=await rows.first().locator('.dream-reorder-handle').boundingBox(),touchTo=await rows.nth(1).boundingBox();
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:touchFrom.x+touchFrom.width/2,y:touchFrom.y+touchFrom.height/2}]});
  for(let step=1;step<=8;step++) await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:touchFrom.x+touchFrom.width/2+(touchTo.x+touchTo.width/2-touchFrom.x-touchFrom.width/2)*step/8,y:touchFrom.y+touchFrom.height/2+(touchTo.y+touchTo.height/2-touchFrom.y-touchFrom.height/2)*step/8}]});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  await expect(rows.first().locator('video')).toHaveCount(1);
  await rows.nth(1).getByRole('button',{name:en['post.dragAttachment'].replace('{index}','2')}).focus();
  await page.keyboard.press('ArrowUp');
  await expect(rows.first().locator('img')).toHaveCount(1);
  await cdp.send('Emulation.setTouchEmulationEnabled',{enabled:false});
  await cdp.detach();
  await page.setViewportSize({width:1440,height:1000});
  await expect(page.getByRole('button',{name:en['post.publish'],exact:true})).toBeEnabled();
  await page.screenshot({path:'../.tmp/dream-media-composer.png'});
  await page.getByRole('button',{name:en['post.publish'],exact:true}).click();
  await expect.poll(()=>dream?.id).toBeTruthy();
  await expect(page.locator('.dream-composer')).toHaveCount(0);
  assert(!new URL(page.url()).searchParams.has('dream'),'publishing does not open the individual Dream');
  await page.goto(`${base}/ambatupost/?dream=${dream.id}`);
  await expect(page.getByText(en['post.processingDream'],{exact:true})).toBeVisible();
  const imageFigure=page.locator('.dream-media-attachment').nth(0),videoFigure=page.locator('.dream-media-attachment').nth(1);
  const image=page.locator('.dream-media-grid .dream-media-image');
  await expect(image).toBeAttached({timeout:10000});
  await expect(videoFigure.locator('.dream-media-video-open')).toBeAttached();
  await expect(page.locator('.dream-media-grid video')).toHaveCount(0);
  await expect(imageFigure).toHaveAttribute('aria-busy','true');
  await expect.poll(()=>page.locator('.dream-media-preview img').evaluateAll(images=>images.length===2&&images.every(img=>img.complete&&img.naturalWidth>0))).toBe(true);
  await page.emulateMedia({reducedMotion:'no-preference'});
  const preview=imageFigure.locator('.dream-media-preview');
  assert.equal(await preview.evaluate(element=>getComputedStyle(element,'::after').animationName),'dream-media-shimmer');
  assert.match(await preview.locator('img').evaluate(img=>getComputedStyle(img).filter),/blur/);
  await page.screenshot({path:'../.tmp/dream-media-loading-desktop.png',fullPage:true});
  await page.evaluate(()=>{document.documentElement.dataset.theme='dark';});
  await page.setViewportSize({width:390,height:844});
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.screenshot({path:'../.tmp/dream-media-loading-mobile-dark.png',fullPage:true});
  await page.emulateMedia({reducedMotion:'reduce'});
  assert.equal(await preview.evaluate(element=>getComputedStyle(element,'::after').animationName),'none');
  const height=await imageFigure.evaluate(element=>element.getBoundingClientRect().height);
  imageGate.release();
  await expect(image).toHaveAttribute('data-ready','true');
  await expect(imageFigure).toHaveAttribute('aria-busy','false');
  assert.equal(await imageFigure.evaluate(element=>element.getBoundingClientRect().height),height,'image decoding preserves reserved space');
  await expect(videoFigure).toHaveAttribute('aria-busy','false');
  const compactPlay=videoFigure.locator('.dream-media-video-open');
  assert(await compactPlay.evaluate(button=>{const box=button.getBoundingClientRect();return button.contains(document.elementFromPoint(box.x+box.width/2,box.y+box.height/2));}),'compact video is a single accessible play target');
  assert(!mediaReads.some(request=>request.id===dream.attachments[1].id&&!request.thumbnail),'compact video is not fetched until opened');
  videoGate.release();
  for(const attachment of uploads.values())assert.equal(thumbnailReads.get(attachment.id),1,'one private thumbnail request per displayed attachment');
  await page.setViewportSize({width:1440,height:1000});
  await page.evaluate(()=>{document.documentElement.dataset.theme='light';});
  await page.screenshot({path:'../.tmp/dream-media-desktop.png'});
  await page.evaluate(()=>{document.documentElement.dataset.theme='dark';});await page.screenshot({path:'../.tmp/dream-media-dark.png'});
  await page.setViewportSize({width:390,height:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:'../.tmp/dream-media-mobile.png'});
  // The gallery keeps focus/scroll contained, pauses inline playback, and
  // preserves video position when expanding, navigating or returning inline.
  await page.setViewportSize({width:1440,height:1000});
  await page.evaluate(()=>{document.documentElement.dataset.theme='light';});
  const openPhoto=imageFigure.locator('.dream-media-open');
  const viewer=page.locator('dialog.dream-media-viewer');
  const oldOverflow=await page.evaluate(()=>document.body.style.overflow);
  await openPhoto.focus();await page.keyboard.press('Enter');
  await expect(viewer).toBeVisible();
  await expect(viewer).toHaveAttribute('aria-label',en['post.photo'].replace('{index}','1'));
  assert.equal(await page.evaluate(()=>document.body.style.overflow),'hidden');
  await expect(viewer.getByRole('button',{name:en['chat.dismiss'],exact:true})).toBeFocused();
  await expect(viewer.getByRole('button',{name:en['tour.back'],exact:true})).toBeDisabled();
  await page.keyboard.press('Shift+Tab');
  await expect(viewer.getByRole('button',{name:en['tour.next'],exact:true})).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(viewer.getByRole('button',{name:en['chat.dismiss'],exact:true})).toBeFocused();
  await expect(viewer.locator('.dream-media-image')).toHaveAttribute('data-ready','true');
  await page.screenshot({path:'../.tmp/dream-gallery-desktop.png'});
  await page.keyboard.press('ArrowRight');
  await expect(viewer).toHaveAttribute('aria-label',en['post.video'].replace('{index}','2'));
  await expect(viewer.locator('.dream-media-image')).toHaveCount(0);
  const galleryVideo=viewer.locator('video');
  await expect.poll(()=>galleryVideo.evaluate(video=>video.readyState)).toBeGreaterThan(1);
  await viewer.locator('.ambatu-video__center-play').click();
  await expect.poll(()=>galleryVideo.evaluate(video=>video.paused)).toBe(false);
  await expect.poll(()=>galleryVideo.evaluate(video=>video.currentTime)).toBeGreaterThan(0.4);
  // Recover when playing fires, and when playback advances without another playing/canplay event.
  const galleryFigure=viewer.locator('.dream-media-attachment');
  const galleryPreview=viewer.locator('.dream-media-preview');
  await galleryVideo.evaluate(video=>{video.pause();video.dispatchEvent(new Event('waiting'));});
  await expect(galleryFigure).toHaveAttribute('aria-busy','true');
  await galleryVideo.evaluate(video=>video.dispatchEvent(new Event('playing')));
  await expect(galleryPreview).toHaveAttribute('data-visible','false');
  await galleryVideo.evaluate(video=>video.play());
  const beforeStall=await galleryVideo.evaluate(video=>video.currentTime);
  await galleryVideo.evaluate(video=>video.dispatchEvent(new Event('waiting')));
  await expect.poll(()=>galleryVideo.evaluate(video=>video.currentTime)).toBeGreaterThan(beforeStall+0.4);
  await expect(galleryPreview).toHaveAttribute('data-visible','false');
  await expect(page.locator('.dream-media-grid video')).toHaveCount(0);
  const gallerySource=await galleryVideo.getAttribute('src'),renewals=sessions.length;
  await galleryVideo.evaluate(video=>{video.dataset.galleryIdentity='preserved';});
  await page.clock.fastForward(121000);
  await expect.poll(()=>sessions.length).toBeGreaterThan(renewals);
  assert.equal(await galleryVideo.getAttribute('src'),gallerySource);
  assert.equal(await galleryVideo.getAttribute('data-gallery-identity'),'preserved','renewal does not remount the viewer player');
  await galleryVideo.evaluate(video=>{video.currentTime=7;});
  await viewer.getByRole('button',{name:en['chat.dismiss'],exact:true}).focus();
  await page.keyboard.press('ArrowLeft');
  await expect(viewer.locator('video')).toHaveCount(0);
  await page.keyboard.press('ArrowRight');
  await expect.poll(()=>galleryVideo.evaluate(video=>video.currentTime)).toBeGreaterThanOrEqual(7);
  await viewer.getByRole('slider',{name:en['media.seek'],exact:true}).focus();
  await page.keyboard.press('ArrowLeft');
  await expect(viewer).toHaveAttribute('aria-label',en['post.video'].replace('{index}','2'));
  await page.keyboard.press('Escape');
  await expect(viewer).toHaveCount(0);await expect(openPhoto).toBeFocused();
  assert.equal(await page.evaluate(()=>document.body.style.overflow),oldOverflow);
  await compactPlay.click();
  await expect(viewer).toBeVisible();
  await expect.poll(()=>galleryVideo.evaluate(video=>video.paused)).toBe(false);
  assert.equal(await page.evaluate(()=>[...document.querySelectorAll('video')].filter(video=>!video.paused).length),1);
  assert.equal(await page.evaluate(()=>window.dispatchEvent(new Event('app-back',{cancelable:true}))),false);
  await expect(viewer).toHaveCount(0);
  await page.setViewportSize({width:390,height:844});
  await page.evaluate(()=>{document.documentElement.dataset.theme='dark';});
  await openPhoto.click();
  assert(await viewer.evaluate(element=>element.getBoundingClientRect().width<=innerWidth));
  await page.screenshot({path:'../.tmp/dream-gallery-mobile-dark.png'});
  const swipe=async(dx)=>viewer.locator('.dream-viewer-stage').evaluate((stage,dx)=>{
    const start=new Event('touchstart',{bubbles:true});Object.defineProperty(start,'touches',{value:[{clientX:190,clientY:300}]});stage.dispatchEvent(start);
    const end=new Event('touchend',{bubbles:true});Object.defineProperty(end,'changedTouches',{value:[{clientX:190+dx,clientY:302}]});stage.dispatchEvent(end);
  },dx);
  await swipe(-100);await expect(viewer).toHaveAttribute('aria-label',en['post.video'].replace('{index}','2'));
  await swipe(100);await expect(viewer).toHaveAttribute('aria-label',en['post.photo'].replace('{index}','1'));
  // A permission/renewal failure removes the open viewer and its media sources.
  denySessions=true;
  await page.clock.fastForward(121000);
  await expect(viewer).toHaveCount(0);
  await expect(page.getByText(en['post.mediaUnavailable'],{exact:true})).toBeVisible();
  assert.equal(await page.evaluate(()=>document.body.style.overflow),oldOverflow);
  denySessions=false;
  await page.getByRole('button',{name:en['common.retry'],exact:true}).click();
  await expect(image).toHaveAttribute('data-ready','true');
  // A missing video poster does not leave the tile stuck or prevent opening.
  failVideoPreview=true;
  await page.reload();
  await expect(videoFigure.locator('.dream-media-video-open')).toBeVisible();
  await expect(videoFigure).toHaveAttribute('aria-busy','false');
  await expect(page.getByText(en['post.mediaUnavailable'],{exact:true})).toHaveCount(0);
  failVideoPreview=false;
  // A missing thumbnail falls back to the shimmer and does not fail valid media.
  failImagePreview=true;imageGate=deferred();
  await page.reload();
  await expect(image).toBeAttached();
  await expect(imageFigure).toHaveAttribute('aria-busy','true');
  await expect(imageFigure.locator('.dream-media-preview img')).toHaveCount(0);
  imageGate.release();
  await expect(image).toHaveAttribute('data-ready','true');
  await expect(page.getByText(en['post.mediaUnavailable'],{exact:true})).toHaveCount(0);
  // Primary-media failure removes placeholders and retains the existing retry.
  failImagePreview=false;failImage=true;
  await page.reload();
  await expect(page.getByText(en['post.mediaUnavailable'],{exact:true})).toBeVisible();
  await expect(page.locator('.dream-media-preview')).toHaveCount(0);
  failImage=false;
  await page.getByRole('button',{name:en['common.retry'],exact:true}).click();
  await expect(image).toHaveAttribute('data-ready','true');
  // Eight attachments occupy five inline tiles; hidden items load only in the viewer.
  const extra=Array.from({length:6},(_,index)=>({id:randomUUID(),kind:index===3?'video':'image',state:'ready',bytes:jpeg.length,width:320,height:180,duration:null,error:null}));
  for(const attachment of extra)uploads.set(attachment.id,attachment);
  const original=[...dream.attachments];
  dream={...dream,attachments:[original[0],extra[0],original[1],extra[1],extra[2],...extra.slice(3)]};
  const beforeMosaic=mediaReads.length;
  await page.reload();
  await expect(page.locator('.dream-media-grid > .dream-media-tile')).toHaveCount(5);
  await expect(page.locator('.dream-media-grid .ambatu-video__controls')).toHaveCount(0);
  await expect(page.locator('.dream-media-video-open')).toHaveCount(1);
  assert(!mediaReads.slice(beforeMosaic).some(request=>request.id===original[1].id&&!request.thumbnail),'gallery video loads its poster only');
  const overflow=page.locator('.dream-media-overflow');
  await expect(overflow).toHaveText('+3');
  await expect(overflow).toHaveAttribute('aria-label',/8 attachments.*\+3/);
  const obscured=page.locator('.dream-media-tile').nth(4).locator('.dream-media-tile-content');
  await expect(obscured).toHaveAttribute('inert','');
  await obscured.locator('.dream-media-open').evaluate(button=>button.focus());
  assert.equal(await obscured.locator('.dream-media-open').evaluate(button=>document.activeElement===button),false,'covered media controls are not keyboard-focusable');
  await expect.poll(()=>thumbnailReads.get(extra[2].id)??0).toBeGreaterThan(0);
  const hidden=new Set(extra.slice(3).map(attachment=>attachment.id));
  assert(!mediaReads.some(request=>hidden.has(request.id)),'hidden media is not requested before opening the viewer');
  await page.screenshot({path:'../.tmp/dream-mosaic-mobile.png',fullPage:true});
  await page.setViewportSize({width:1440,height:1000});
  await page.screenshot({path:'../.tmp/dream-mosaic-desktop.png',fullPage:true});
  await overflow.click();
  await expect(viewer).toHaveAttribute('aria-label',en['post.photo'].replace('{index}','5'));
  await expect(viewer.getByText('5 / 8 attachments',{exact:true})).toBeVisible();
  await viewer.getByRole('button',{name:en['tour.next'],exact:true}).click();
  await expect(viewer).toHaveAttribute('aria-label',en['post.video'].replace('{index}','6'));
  await expect.poll(()=>mediaReads.some(request=>request.id===extra[3].id)).toBe(true);
  await viewer.getByRole('button',{name:en['tour.next'],exact:true}).click();
  await expect(viewer).toHaveAttribute('aria-label',en['post.photo'].replace('{index}','7'));
  await viewer.getByRole('button',{name:en['tour.next'],exact:true}).click();
  await expect(viewer).toHaveAttribute('aria-label',en['post.photo'].replace('{index}','8'));
  await expect(viewer.getByRole('button',{name:en['tour.next'],exact:true})).toBeDisabled();
  await page.keyboard.press('Escape');await expect(viewer).toHaveCount(0);await expect(overflow).toBeFocused();
  const allAttachments=[...dream.attachments];
  for(const count of [1,2,3,4,5,6]){
    dream={...dream,attachments:allAttachments.slice(0,count)};
    await page.reload();
    const tiles=page.locator('.dream-media-grid > .dream-media-tile');
    await expect(tiles).toHaveCount(Math.min(count,5));
    await expect(page.locator('.dream-media-overflow')).toHaveCount(count>5?1:0);
    if(count===3){
      const first=await tiles.nth(0).boundingBox(),second=await tiles.nth(1).boundingBox(),third=await tiles.nth(2).boundingBox();
      assert(first.height>second.height*1.8 && second.y<third.y,'three attachments use one tall tile and two stacked tiles');
    }
    if(count===5){
      const first=await tiles.nth(0).boundingBox(),second=await tiles.nth(1).boundingBox(),third=await tiles.nth(2).boundingBox(),fifth=await tiles.nth(4).boundingBox();
      assert(first.y===second.y && third.y>first.y && fifth.y===third.y,'five attachments use two upper and three lower tiles');
    }
    if(count===6)await expect(page.locator('.dream-media-overflow')).toHaveText('+1');
  }
  // A Dream containing only one video retains its inline player and transfers position when expanded.
  dream={...dream,attachments:[original[1]]};
  await page.reload();
  const singlePlayer=page.locator('.dream-media-grid video');
  await expect.poll(()=>singlePlayer.evaluate(video=>video.readyState)).toBeGreaterThan(1);
  await page.locator('.dream-media-grid .ambatu-video__center-play').click();
  await expect.poll(()=>singlePlayer.evaluate(video=>video.paused)).toBe(false);
  await singlePlayer.evaluate(video=>{video.currentTime=7;});
  await page.locator('.dream-media-grid .dream-media-expand').click();
  await expect(viewer).toBeVisible();
  await expect.poll(()=>galleryVideo.evaluate(video=>video.currentTime)).toBeGreaterThanOrEqual(7);
  assert(await singlePlayer.evaluate(video=>video.paused));
  await galleryVideo.evaluate(video=>{video.currentTime=9;});
  await viewer.getByRole('button',{name:en['chat.dismiss'],exact:true}).click();
  await expect(viewer).toHaveCount(0);
  assert(Math.abs(await singlePlayer.evaluate(video=>video.currentTime)-9)<0.5);
  await page.locator('.dream-media-grid .ambatu-video__center-play').click();
  await expect.poll(()=>singlePlayer.evaluate(video=>video.paused)).toBe(false);
  await page.setViewportSize({width:1440,height:400});
  await page.evaluate(()=>scrollTo(0,document.documentElement.scrollHeight));
  await expect.poll(()=>singlePlayer.evaluate(video=>video.paused)).toBe(true);
  dream={...dream,attachments:allAttachments};
  await page.reload();
  const oldOrder=dream.attachments.map(item=>item.id);
  await page.locator('.dream-detail').getByRole('button',{name:en['chat.moreActions'],exact:true}).click();
  await page.getByRole('button',{name:en['post.edit'],exact:true}).click();
  await expect(page.locator('.dream-upload-preview img')).toHaveCount(allAttachments.length);
  await page.locator('.dream-upload-list li').nth(1).getByRole('button',{name:en['post.dragAttachment'].replace('{index}','2')}).focus();
  await page.keyboard.press('ArrowUp');
  await page.getByRole('button',{name:en['post.saveChanges'],exact:true}).click();
  await expect.poll(()=>dream.attachments[0].id).toBe(oldOrder[1]);
  assert.equal(dream.attachments[1].id,oldOrder[0],'published attachment order persists after editing');
  await page.reload();
  assert.deepEqual(dream.attachments.slice(0,2).map(item=>item.id),[oldOrder[1],oldOrder[0]]);
  await page.locator('.dream-detail').getByRole('button',{name:en['chat.moreActions'],exact:true}).click();
  await page.getByRole('button',{name:en['post.delete'],exact:true}).click();
  await page.getByRole('dialog',{name:en['post.deleteTitle']}).getByRole('button',{name:en['post.delete'],exact:true}).click();
  await expect(page.getByText(en['post.deleted'],{exact:true})).toBeVisible();
  await expect.poll(()=>operationReads).toBeGreaterThan(0);
  for(const key of ['post.pendingDeletion','post.cleanupRetrying','post.cleanupComplete'])await expect(page.getByText(en[key],{exact:true})).toHaveCount(0);
  await page.clock.fastForward(6000);
  await expect(page.getByText(en['post.deleted'],{exact:true})).toHaveCount(0);
  await expect.poll(async()=>{
    // Completion stays in the background after the confirmation disappears.
    await page.clock.fastForward(16000);
    return operationReads>1;
  }).toBe(true);
  await page.clock.fastForward(30000);
  assert.equal(operationReads,2,'receipt polling stops after completion');
  for(const key of ['post.pendingDeletion','post.cleanupRetrying','post.cleanupComplete'])await expect(page.getByText(en[key],{exact:true})).toHaveCount(0);
  await page.screenshot({path:'../.tmp/dream-media-deleted-mobile.png'});
  assert.deepEqual(errors,[]);console.log('Passed mixed-media uploads, limits, media-only publishing, processing polling, image/video playback, session renewal without changing source, offscreen pause, blurred loading/thumbnail fallback/buffering/playing-event and advancing-playback recovery/retry, accessible mixed-media gallery/position/focus/swipe/native-back/privacy, five-tile overflow, cleanup receipts and responsive layouts.');
}finally{await browser.close();}
