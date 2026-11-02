import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';

type Snapshot = { phase: string; elapsed: number; position: number[]; grounded: boolean; objective: number; hasKey: boolean; hasData: boolean; ammo: number; reserve: number; aiming: boolean; reloading: boolean; health: number; kills: number; living: number; crouching: boolean; sprinting: boolean; prompt: string; notification: string; weapon: string; doors: {kind:string;open:boolean;angle:number}[]; render: { calls:number;triangles:number;geometries:number;textures:number } };
async function snapshot(page: Page): Promise<Snapshot> { return page.evaluate(() => (window as any).__DUSKLINE__.snapshot()); }
async function advance(page: Page, seconds: number) {
  const before = (await snapshot(page)).elapsed;
  await page.waitForFunction(({before, seconds}) => (window as any).__DUSKLINE__.snapshot().elapsed >= before + seconds, { before, seconds }, {timeout: 60_000});
}
async function position(page: Page, p: number[], look: number[]) {
  await page.evaluate(({p}) => (window as any).__DUSKLINE__.teleport(p[0], .05, p[1]), {p});
  await advance(page, .12);
  await page.evaluate(({look}) => (window as any).__DUSKLINE__.lookAt(...look), {look});
  await advance(page, .12);
}
async function interact(page: Page, label: RegExp) {
  await expect.poll(async () => (await snapshot(page)).prompt, {timeout: 15_000}).toMatch(label);
  await page.keyboard.press('e');
  await advance(page, .12);
}

test.use({ viewport: { width: 960, height: 640 } });

test('rendered desktop mission: collisions, combat, ordered interactions, pause, extraction and restart', async ({ page }) => {
  test.setTimeout(600_000);
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript(() => localStorage.setItem('duskline-settings-v1', JSON.stringify({ quality: 'low', motion: false, volume: 0 })));
  await page.goto('/?test=1');
  await page.waitForFunction(() => (window as any).__DUSKLINE__, undefined, { timeout: 90_000 });
  await expect(page.getByRole('button', {name:'START MISSION',exact:true})).toBeVisible();
  fs.mkdirSync('artifacts',{recursive:true});
  await page.screenshot({path:'artifacts/qa-menu.png'});
  console.log('menu rendered', (await snapshot(page)).render);

  await page.getByRole('button',{name:'Settings',exact:true}).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  const sensitivity=page.getByRole('slider',{name:/Mouse sensitivity/});
  await sensitivity.focus();
  for(let i=0;i<4;i++) await sensitivity.press('ArrowRight');
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('duskline-settings-v1')!).sensitivity)).toBe(1.2);
  await page.getByRole('button',{name:'Done',exact:true}).click();
  await page.getByRole('button',{name:'START MISSION',exact:true}).click();
  await page.waitForFunction(() => (window as any).__DUSKLINE__.snapshot().elapsed > .15, undefined, {timeout:60_000});
  expect(await page.evaluate(() => !!document.pointerLockElement)).toBe(true);
  console.log('mission started');
  await page.screenshot({path:'artifacts/qa-start.png'});
  await page.setViewportSize({width:640,height:420});
  const start = await snapshot(page);
  expect(start.render.triangles).toBeGreaterThan(30_000);
  expect(start.grounded).toBe(true);
  await page.keyboard.down('w'); await advance(page, .7); await page.keyboard.up('w');
  expect((await snapshot(page)).position[2]).toBeLessThan(start.position[2] - 1);
  await page.keyboard.down('Control'); await advance(page,.2); expect((await snapshot(page)).crouching).toBe(true); await page.keyboard.up('Control');
  await advance(page,.2);
  await page.keyboard.press('Space'); await advance(page,.15); expect((await snapshot(page)).position[1]).toBeGreaterThan(.2); await advance(page,.8);
  console.log('movement and jump verified');

  // The closed, locked physical facility door blocks forward movement.
  await position(page,[0,-7],[0,1.65,-11]);
  await interact(page,/LOCKED.*ACCESS CARD/);
  expect((await snapshot(page)).hasKey).toBe(false);
  await page.keyboard.down('w'); await advance(page,1); await page.keyboard.up('w');
  const blocked = await snapshot(page);
  expect(blocked.position[2]).toBeGreaterThan(-9.55);
  expect(blocked.position[2]).toBeLessThan(-8.8);
  console.log('locked door blocks movement',blocked.position);

  // Pause freezes both simulation time and actual drone patrol transforms.
  await page.keyboard.press('p');
  await expect(page.getByRole('button',{name:'RESUME MISSION',exact:true})).toBeVisible();
  const paused = await snapshot(page);
  const patrolBefore = await page.evaluate(() => (window as any).__DUSKLINE__.enemyPositions());
  await page.waitForTimeout(800);
  expect((await snapshot(page)).elapsed).toBe(paused.elapsed);
  expect(await page.evaluate(() => (window as any).__DUSKLINE__.enemyPositions())).toEqual(patrolBefore);
  await page.getByRole('button',{name:'RESUME MISSION',exact:true}).click();
  await advance(page,.2);

  // Only genuine raycast interactions acquire mission state.
  await position(page,[-8,-4.1],[-11,1.25,-4]);
  await interact(page,/COLLECT ACCESS CARD/);
  expect((await snapshot(page)).hasKey).toBe(true);
  expect((await snapshot(page)).objective).toBe(2);
  console.log('card recovered');
  await position(page,[0,-7],[0,1.8,-10]);
  await interact(page,/OPEN FACILITY DOOR/);
  await advance(page,.8);
  expect((await snapshot(page)).doors.find(d=>d.kind==='facility')?.open).toBe(true);
  await page.keyboard.down('w'); await advance(page,1.5); await page.keyboard.up('w');
  expect((await snapshot(page)).position[2]).toBeLessThan(-11);
  console.log('opened door crossed');

  // ADS, ammunition accounting, magazine completion and distinct sidearm.
  await page.mouse.down({button:'right'}); await advance(page,.2); expect((await snapshot(page)).aiming).toBe(true); await page.mouse.up({button:'right'});
  const full = await snapshot(page);
  await page.mouse.down(); await advance(page,.45); await page.mouse.up();
  const fired = await snapshot(page); expect(fired.ammo).toBeLessThan(full.ammo);
  await page.keyboard.press('r'); await advance(page,.1); expect((await snapshot(page)).reloading).toBe(true);
  await advance(page,2.1); const loaded=await snapshot(page);
  expect(loaded.ammo).toBe(30); expect(loaded.reserve).toBe(full.reserve-(full.ammo-fired.ammo));
  await page.keyboard.press('2'); await advance(page,.4); expect((await snapshot(page)).weapon).toMatch(/SIDEARM/); expect((await snapshot(page)).ammo).toBe(12);
  await page.keyboard.press('1'); await advance(page,.4); expect((await snapshot(page)).ammo).toBe(30);
  console.log('weapon controls verified');

  // Aim at the visible security unit and fire actual raycasts until defeated.
  // Stand behind the sentry; the south approach has a correctly occluding crate.
  await position(page,[-6,-27],[-6,1.6,-24]);
  const beforeCombat=await snapshot(page);
  await page.mouse.down();
  for (let i=0; i<14 && (await snapshot(page)).kills===beforeCombat.kills;i++) {
    await page.evaluate(()=>{const d=(window as any).__DUSKLINE__;const p=d.enemyPositions()[0];d.lookAt(p[0],p[1],p[2]);});
    await advance(page,.16);
  }
  await page.mouse.up();
  expect((await snapshot(page)).kills).toBeGreaterThan(beforeCombat.kills);
  console.log('security unit defeated');

  await position(page,[0,-56.5],[0,1.8,-59]);
  await interact(page,/OPEN RESEARCH DOOR/); await advance(page,.8);
  await page.keyboard.down('w'); await advance(page,1.5); await page.keyboard.up('w');
  expect((await snapshot(page)).objective).toBe(3);
  await position(page,[5,-67.5],[5,1.6,-70]);
  await interact(page,/RECOVER DATA MODULE/);
  expect((await snapshot(page)).hasData).toBe(true);
  expect((await snapshot(page)).objective).toBe(4);
  await page.screenshot({path:'artifacts/qa-control-room.png'});
  console.log('data recovered');
  await position(page,[0,-75.5],[0,1.8,-78]);
  await interact(page,/OPEN EXIT DOOR/); await advance(page,.8);
  await page.keyboard.down('w'); await advance(page,1.5); await page.keyboard.up('w');
  expect((await snapshot(page)).position[2]).toBeLessThan(-79);
  await position(page,[0,-91.5],[0,1.65,-94]);
  await page.keyboard.down('w');
  await page.waitForFunction(()=>(window as any).__DUSKLINE__.snapshot().phase==='complete',undefined,{timeout:30_000});
  await page.keyboard.up('w');
  await expect(page.getByRole('button',{name:'REPLAY OPERATION',exact:true})).toBeVisible();
  await page.screenshot({path:'artifacts/qa-complete.png'});
  console.log('mission completed');
  const completed=await snapshot(page);
  expect(await page.evaluate(()=>(window as any).__DUSKLINE__.audio().initialized)).toBe(true);
  await page.getByRole('button',{name:'REPLAY OPERATION',exact:true}).click();
  await advance(page,.2);
  const restarted=await snapshot(page);
  expect(restarted.phase).toBe('playing'); expect(restarted.health).toBe(100); expect(restarted.ammo).toBe(30); expect(restarted.kills).toBe(0); expect(restarted.hasKey).toBe(false); expect(restarted.hasData).toBe(false); expect(restarted.living).toBe(5);
  expect(restarted.render.geometries).toBe(completed.render.geometries);
  expect(restarted.render.textures).toBe(completed.render.textures);
  console.log('restart resource counts',completed.render,restarted.render);
  const audio=await page.evaluate(()=>(window as any).__DUSKLINE__.audio());
  expect(audio.loaded).toBe(18); expect(audio.ambienceLoops).toBe(2); expect(audio.state).toBe('running');

  // Non-mission objects use the same raycast interaction system and live physics.
  await position(page,[-1.5,-47],[-3.5,1.5,-47]);
  await interact(page,/SWITCH AUXILIARY LIGHTS OFF/);
  let props=await page.evaluate(()=>(window as any).__DUSKLINE__.props());
  expect(props.auxiliaryPower).toBe(false); expect(props.lightIntensities.every((n:number)=>n===0)).toBe(true);
  await interact(page,/SWITCH AUXILIARY LIGHTS ON/);
  expect((await page.evaluate(()=>(window as any).__DUSKLINE__.props())).auxiliaryPower).toBe(true);
  await position(page,[8,-28.5],[8,.8,-31]);
  const storageReserve=(await snapshot(page)).reserve;
  await interact(page,/OPEN FIELD STORAGE/);
  props=await page.evaluate(()=>(window as any).__DUSKLINE__.props());
  expect(props.storageOpen).toBe(true); expect(props.storageUsed).toBe(true); expect((await snapshot(page)).reserve).toBe(storageReserve+30);
  await interact(page,/CLOSE FIELD STORAGE/); await interact(page,/OPEN FIELD STORAGE/);
  expect((await snapshot(page)).reserve).toBe(storageReserve+30);
  await position(page,[-2.7,-23.5],[-2.7,.4,-26]);
  const crateBefore=(await page.evaluate(()=>(window as any).__DUSKLINE__.props())).dynamicPositions[0].position;
  await interact(page,/PUSH EQUIPMENT CRATE/); await advance(page,.4);
  const crateAfter=(await page.evaluate(()=>(window as any).__DUSKLINE__.props())).dynamicPositions[0].position;
  expect(Math.hypot(crateAfter[0]-crateBefore[0],crateAfter[2]-crateBefore[2])).toBeGreaterThan(.1);
  await position(page,[7,-67.2],[8.5,1.9,-67.2]);
  expect((await page.evaluate(()=>(window as any).__DUSKLINE__.props())).glassIntact).toBe(true);
  await page.mouse.down(); await advance(page,.2); await page.mouse.up();
  expect((await page.evaluate(()=>(window as any).__DUSKLINE__.props())).glassIntact).toBe(false);
  console.log('auxiliary lights, storage, physical crate and breakable glass verified');
  expect(errors).toEqual([]);
});

test.describe('touchscreen', () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 640, height: 420 } });
  test('landscape touch controls move, look, fire, crouch and pause without pointer lock', async ({page}) => {
    test.setTimeout(180_000);
    await page.addInitScript(() => localStorage.setItem('duskline-settings-v1', JSON.stringify({quality:'low',motion:false,volume:0})));
    await page.goto('/?test=1');
    await page.waitForFunction(()=>(window as any).__DUSKLINE__,undefined,{timeout:90_000});
    await page.getByRole('button',{name:'START MISSION',exact:true}).tap();
    await advance(page,.2);
    expect(await page.evaluate(()=>!!document.pointerLockElement)).toBe(false);
    const cdp=await page.context().newCDPSession(page);
    const stick=await page.getByLabel('Movement joystick').boundingBox();
    expect(stick).not.toBeNull();
    const x=stick!.x+stick!.width/2,y=stick!.y+stick!.height/2;
    const initial=await snapshot(page);
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y,id:1}]});
    await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x,y:y-40,id:1}]});
    await advance(page,.65);
    await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    expect((await snapshot(page)).position[2]).toBeLessThan(initial.position[2]-1);
    const look=await page.locator('.touch-look').boundingBox();
    const lx=look!.x+look!.width*.4,ly=look!.y+look!.height*.3;
    const h=await page.evaluate(()=>(window as any).__DUSKLINE__.snapshot().heading);
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:lx,y:ly,id:2}]});
    await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:lx+60,y:ly,id:2}]});
    await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    await advance(page,.15);
    expect(await page.evaluate(()=>(window as any).__DUSKLINE__.snapshot().heading)).not.toBe(h);
    const fire=await page.getByRole('button',{name:'Fire',exact:true}).boundingBox();
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:fire!.x+fire!.width/2,y:fire!.y+fire!.height/2,id:3}]});
    await advance(page,.3);
    await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    expect((await snapshot(page)).ammo).toBeLessThan(initial.ammo);
    await page.getByRole('button',{name:/CROUCH/}).tap(); await advance(page,.15); expect((await snapshot(page)).crouching).toBe(true);
    await page.getByRole('button',{name:'Pause mission'}).tap();
    await expect(page.getByRole('button',{name:'RESUME MISSION',exact:true})).toBeVisible();
    await page.screenshot({path:'artifacts/qa-touch.png'});
  });
});

test('perimeter fences prevent facility bypasses; ammo and medical supplies are functional', async ({page}) => {
  test.setTimeout(240_000);
  await page.setViewportSize({width:640,height:420});
  await page.addInitScript(() => localStorage.setItem('duskline-settings-v1',JSON.stringify({quality:'low',motion:false,volume:0})));
  await page.goto('/?test=1');
  await page.waitForFunction(()=>(window as any).__DUSKLINE__,undefined,{timeout:90_000});
  await page.getByRole('button',{name:'START MISSION',exact:true}).click();
  await advance(page,.2);
  await position(page,[16,-7],[16,1.65,-11]);
  await page.keyboard.down('w'); await advance(page,1); await page.keyboard.up('w');
  const yard=(await snapshot(page)).position;
  expect(yard[2]).toBeGreaterThan(-9.55); expect(yard[2]).toBeLessThan(-8.8);
  await position(page,[13.5,-80.5],[13.5,1.65,-76]);
  await page.keyboard.down('w'); await advance(page,1); await page.keyboard.up('w');
  const extraction=(await snapshot(page)).position;
  expect(extraction[2]).toBeLessThan(-78.45); expect(extraction[2]).toBeGreaterThan(-79.1);
  console.log('perimeter fence collisions',yard,extraction);
  await position(page,[-5,-17.5],[-5,.9,-20]);
  const reserve=(await snapshot(page)).reserve;
  await interact(page,/COLLECT AMMUNITION/);
  expect((await snapshot(page)).reserve).toBe(reserve+60);
  expect((await snapshot(page)).prompt).not.toMatch(/COLLECT AMMUNITION/);
  await position(page,[-2.5,-50.5],[-2.5,.9,-53]);
  await page.evaluate(()=>(window as any).__DUSKLINE__.hurt(45));
  const hurt=(await snapshot(page)).health;
  expect(hurt).toBeLessThanOrEqual(55);
  await interact(page,/USE MEDICAL SUPPLIES/);
  const healed=(await snapshot(page)).health;
  expect(healed).toBeGreaterThan(hurt); expect(healed).toBeGreaterThanOrEqual(94); expect(healed).toBeLessThanOrEqual(100);
  expect((await snapshot(page)).prompt).not.toMatch(/USE MEDICAL SUPPLIES/);
  await page.screenshot({path:'artifacts/qa-supplies.png'});
  console.log('ammo and medical pickups verified',reserve,(await snapshot(page)).reserve,hurt,healed);
});
