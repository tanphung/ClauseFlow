import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { chromium } from "playwright";

const timingPath = resolve(process.argv[2] || "demo-video/timings.json");
const outputPath = resolve(process.argv[3] || "demo-video/raw/clauseflow-demo.webm");
const metadataPath = resolve(process.argv[4] || "demo-video/raw/recording-metadata.json");
const scenes = JSON.parse(readFileSync(timingPath, "utf8").replace(/^\uFEFF/, ""));
const duration = (id) => Math.max(1, Number(scenes.find((scene) => scene.id === id)?.durationSeconds || 1));
const caption = (id) => scenes.find((scene) => scene.id === id)?.caption || "";

mkdirSync(dirname(outputPath), { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true, args: ["--hide-scrollbars"] });
const context = await browser.newContext({
  viewport: { width: 1920, height: 1080 },
  deviceScaleFactor: 1,
  recordVideo: { dir: dirname(outputPath), size: { width: 1920, height: 1080 } },
});
const startedAt = Date.now();
const page = await context.newPage();
let pointerAnchor = { x: 960, y: 540, width: 80, height: 48 };
const recordedScenes = [];

await page.goto("https://clauseflow-two.vercel.app", { waitUntil: "domcontentloaded", timeout: 60_000 });
await page.getByRole("heading", { name: "Public on-chain agreement dashboard", exact: true }).waitFor({ state: "visible", timeout: 30_000 });
await page.getByRole("region", { name: "Protocol summary", exact: true }).getByText("0.015", { exact: true }).waitFor({ state: "visible", timeout: 30_000 });
await installRecordingOverlay(page);
const preRollSeconds = (Date.now() - startedAt) / 1000;

await recordScene("intro", () => runTimed(duration("intro"), async () => {
  await showIntro(page, caption("intro"), duration("intro"));
  await wait(page, Math.max(0.5, duration("intro") - 0.5));
  await hideIntro(page);
}));

await recordScene("dashboard", () => runDashboard(page, duration("dashboard"), caption("dashboard")));
await recordScene("payment", () => runPayment(page, duration("payment"), caption("payment")));
await recordScene("refund", () => runRefund(page, duration("refund"), caption("refund")));
await recordScene("discovery", () => runDiscovery(page, duration("discovery"), caption("discovery")));
await recordScene("workspace", () => runWorkspace(page, duration("workspace"), caption("workspace")));
await recordScene("close", () => runClose(page, duration("close"), caption("close")));

const video = page.video();
await page.close();
await context.close();
if (!video) throw new Error("Playwright did not create a recording");
await video.saveAs(outputPath);
await browser.close();
writeFileSync(metadataPath, JSON.stringify({
  preRollSeconds,
  sceneDurationSeconds: recordedScenes.reduce((sum, scene) => sum + scene.durationSeconds, 0),
  scenes: recordedScenes,
}, null, 2));
console.log(`DEMO_RECORDING_OK video=${outputPath} metadata=${metadataPath}`);

async function installRecordingOverlay(target) {
  await target.evaluate(() => {
    const style = document.createElement("style");
    style.textContent = `
      #cf-demo-caption { position: fixed; left: 50%; bottom: 34px; z-index: 2147483646; transform: translateX(-50%) translateY(16px); width: min(920px, calc(100vw - 96px)); padding: 16px 22px; overflow: hidden; color: #f7fbf8; background: rgba(9, 48, 40, .94); border: 1px solid rgba(255,255,255,.18); border-radius: 8px; box-shadow: 0 16px 44px rgba(6,28,23,.25); font: 700 22px/1.35 Arial, sans-serif; letter-spacing: 0; text-align: center; opacity: 0; transition: opacity .28s ease, transform .28s ease; pointer-events: none; }
      #cf-demo-caption.visible { opacity: 1; transform: translateX(-50%) translateY(0); }
      #cf-demo-caption::after { content: ""; position: absolute; left: 0; bottom: 0; width: 100%; height: 4px; background: #ef5b47; transform: scaleX(0); transform-origin: left center; }
      #cf-demo-caption.visible::after { animation: cf-demo-progress var(--scene-duration, 10s) linear forwards; }
      #cf-demo-cursor { position: fixed; left: -100px; top: -100px; z-index: 2147483647; width: 28px; height: 36px; background: no-repeat center/contain url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='28' height='36' viewBox='0 0 28 36'%3E%3Cpath d='M3 2.5v25.1l6.5-6.1 4.9 11.1 5-2.2-4.8-10.8h9.1L3 2.5Z' fill='%23fff' stroke='%23071916' stroke-width='2.2' stroke-linejoin='round'/%3E%3C/svg%3E"); filter: drop-shadow(0 3px 3px rgba(0,0,0,.38)); pointer-events: none; transform-origin: 3px 3px; transition: transform .12s ease, opacity .2s ease; }
      #cf-demo-intro { position: fixed; inset: 0; z-index: 2147483645; display: grid; place-items: center; color: #fff; background: rgba(7,38,32,.86); backdrop-filter: blur(6px); opacity: 0; transition: opacity .35s ease; pointer-events: none; }
      #cf-demo-intro.visible { opacity: 1; }
      #cf-demo-intro .inner { width: min(1040px, calc(100vw - 160px)); text-align: center; }
      #cf-demo-intro h2 { margin: 0 0 20px; color: #fff; font: 800 68px/1.05 Arial, sans-serif; letter-spacing: 0; }
      #cf-demo-intro p { margin: 0 auto; max-width: 940px; color: #d9ebe4; font: 500 30px/1.4 Arial, sans-serif; letter-spacing: 0; }
      #cf-demo-intro .proof { margin-top: 30px; color: #9ed8c7; font: 700 18px/1.4 Arial, sans-serif; text-transform: uppercase; }
      #cf-demo-intro .proof::after { content: ""; display: block; width: 360px; max-width: 70vw; height: 3px; margin: 18px auto 0; background: #ef5b47; transform: scaleX(0); transform-origin: left center; }
      #cf-demo-intro.visible .proof::after { animation: cf-demo-progress var(--scene-duration, 10s) linear forwards; }
      @keyframes cf-demo-progress { to { transform: scaleX(1); } }
    `;
    document.head.append(style);
    const captionNode = document.createElement("div");
    captionNode.id = "cf-demo-caption";
    const cursor = document.createElement("div");
    cursor.id = "cf-demo-cursor";
    const intro = document.createElement("div");
    intro.id = "cf-demo-intro";
    intro.innerHTML = '<div class="inner"><h2>ClauseFlow</h2><p></p><div class="proof">Live on GenLayer Bradbury</div></div>';
    document.body.append(captionNode, cursor, intro);
    document.addEventListener("mousemove", (event) => {
      cursor.style.left = `${event.clientX}px`;
      cursor.style.top = `${event.clientY}px`;
    });
    document.addEventListener("mousedown", () => { cursor.style.transform = "scale(.72)"; });
    document.addEventListener("mouseup", () => { cursor.style.transform = "scale(1)"; });
  });
}

async function setCaption(target, text, seconds) {
  await target.evaluate(({ value, durationSeconds }) => {
    const node = document.querySelector("#cf-demo-caption");
    if (!node) return;
    node.classList.remove("visible");
    node.textContent = value;
    node.style.setProperty("--scene-duration", `${durationSeconds}s`);
    void node.offsetWidth;
    node.classList.add("visible");
  }, { value: text, durationSeconds: seconds });
}

async function hideCaption(target) {
  await target.evaluate(() => document.querySelector("#cf-demo-caption")?.classList.remove("visible"));
  await target.waitForTimeout(220);
}

async function showIntro(target, text, seconds) {
  await target.evaluate(({ value, durationSeconds }) => {
    const intro = document.querySelector("#cf-demo-intro");
    if (!intro) return;
    intro.classList.remove("visible");
    document.querySelector("#cf-demo-caption")?.classList.remove("visible");
    const cursor = document.querySelector("#cf-demo-cursor");
    if (cursor) cursor.style.opacity = "0";
    const paragraph = intro.querySelector("p");
    if (paragraph) paragraph.textContent = value;
    intro.style.setProperty("--scene-duration", `${durationSeconds}s`);
    void intro.offsetWidth;
    intro.classList.add("visible");
  }, { value: text, durationSeconds: seconds });
}

async function hideIntro(target) {
  await target.evaluate(() => {
    document.querySelector("#cf-demo-intro")?.classList.remove("visible");
    const cursor = document.querySelector("#cf-demo-cursor");
    if (cursor) cursor.style.opacity = "1";
  });
  await target.waitForTimeout(450);
}

async function click(target, locator) {
  await smoothReveal(target, locator);
  const box = await locator.boundingBox();
  if (!box) throw new Error("Demo target is not visible");
  pointerAnchor = box;
  await target.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 24 });
  await target.waitForTimeout(220);
  await locator.click();
  await target.waitForTimeout(350);
}

async function point(target, locator) {
  await smoothReveal(target, locator);
  const box = await locator.boundingBox();
  if (!box) return;
  pointerAnchor = box;
  await target.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 28 });
}

async function wait(target, seconds) {
  const deadline = Date.now() + Math.max(250, seconds * 1_000);
  const offsets = [
    [0.42, 0.48],
    [0.58, 0.43],
    [0.62, 0.58],
    [0.46, 0.62],
  ];
  let index = 0;
  while (Date.now() < deadline) {
    const [xRatio, yRatio] = offsets[index % offsets.length];
    const x = Math.max(28, Math.min(1890, pointerAnchor.x + pointerAnchor.width * xRatio));
    const y = Math.max(28, Math.min(1040, pointerAnchor.y + pointerAnchor.height * yRatio));
    await target.mouse.move(x, y, { steps: 12 });
    const remaining = deadline - Date.now();
    if (remaining > 0) await target.waitForTimeout(Math.min(240, remaining));
    index += 1;
  }
}

async function smoothReveal(target, locator) {
  await locator.evaluate((element) => element.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" }));
  await target.waitForTimeout(650);
}

async function runTimed(seconds, action) {
  const started = Date.now();
  await action();
  const remaining = seconds * 1_000 - (Date.now() - started);
  if (remaining > 0) await page.waitForTimeout(remaining);
}

async function recordScene(id, action) {
  const started = Date.now();
  await action();
  recordedScenes.push({ id, durationSeconds: (Date.now() - started) / 1_000 });
}

async function runDashboard(target, seconds, text) {
  await runTimed(seconds, async () => {
    await target.reload({ waitUntil: "domcontentloaded", timeout: 60_000 });
    await target.getByRole("heading", { name: "Public on-chain agreement dashboard", exact: true }).waitFor({ state: "visible", timeout: 30_000 });
    await installRecordingOverlay(target);
    await setCaption(target, text, seconds);
    const snapshotStatus = target.getByRole("status").filter({ hasText: /Verified on-chain snapshot|Cached on-chain data/ });
    await snapshotStatus.waitFor({ state: "visible", timeout: 5_000 });
    await point(target, snapshotStatus);
    await wait(target, seconds * 0.08);
    const liveStatus = target.getByRole("status").filter({ hasText: /Live on-chain data synced/ });
    const liveSynced = await liveStatus.waitFor({ state: "visible", timeout: 8_000 }).then(() => true).catch(() => false);
    await point(target, liveSynced ? liveStatus : snapshotStatus);
    await wait(target, seconds * 0.06);
    await point(target, target.getByRole("region", { name: "Protocol summary", exact: true }));
    await wait(target, seconds * 0.12);
    const rows = target.locator("button.ledgerRow");
    await point(target, rows.first());
    await wait(target, seconds * 0.08);
  });
}

async function runPayment(target, seconds, text) {
  await runTimed(seconds, async () => {
    await hideCaption(target);
    const row = target.locator("button.ledgerRow").filter({ hasText: "ClauseFlow release evidence dossier" });
    await click(target, row);
    await target.evaluate(() => window.scrollTo({ top: 0, behavior: "smooth" }));
    await setCaption(target, text, seconds);
    await wait(target, seconds * 0.14);
    await click(target, target.getByRole("tab", { name: "Evidence & review", exact: true }));
    await point(target, target.locator(".reviewScore"));
    await wait(target, seconds * 0.08);
    await point(target, target.locator(".fullReportCue"));
    await wait(target, seconds * 0.08);
    await point(target, target.locator(".assessmentCard").first());
    await wait(target, seconds * 0.16);
    await point(target, target.locator(".assessmentCard").nth(1));
    await wait(target, seconds * 0.1);
    await click(target, target.getByRole("tab", { name: "On-chain history", exact: true }));
    await point(target, target.locator(".historyList"));
    await wait(target, seconds * 0.1);
  });
}

async function runRefund(target, seconds, text) {
  await runTimed(seconds, async () => {
    await hideCaption(target);
    await click(target, target.getByRole("button", { name: "Dashboard", exact: true }));
    const row = target.locator("button.ledgerRow").filter({ hasText: "ClauseFlow accessibility audit agreement" });
    await click(target, row);
    await target.evaluate(() => window.scrollTo({ top: 0, behavior: "smooth" }));
    await setCaption(target, text, seconds);
    await wait(target, seconds * 0.12);
    await click(target, target.getByRole("tab", { name: "Evidence & review", exact: true }));
    await point(target, target.locator(".reviewScore"));
    await wait(target, seconds * 0.08);
    await point(target, target.locator(".assessmentCard").first());
    await wait(target, seconds * 0.14);
    await point(target, target.locator(".reviewPanel .clause").filter({ hasText: "Missing items" }));
    await wait(target, seconds * 0.12);
    await click(target, target.getByRole("tab", { name: "On-chain history", exact: true }));
    await point(target, target.locator(".historyList"));
    await wait(target, seconds * 0.1);
  });
}

async function runDiscovery(target, seconds, text) {
  await runTimed(seconds, async () => {
    await hideCaption(target);
    await click(target, target.getByRole("button", { name: "Dashboard", exact: true }));
    await setCaption(target, text, seconds);
    const search = target.getByRole("textbox", { name: "Search agreements", exact: true });
    await click(target, search);
    await search.fill("accessibility");
    await wait(target, seconds * 0.26);
    await search.fill("");
    const builder = target.getByRole("textbox", { name: "Builder address filter", exact: true });
    await click(target, builder);
    await builder.fill("0xd2A9");
    await wait(target, seconds * 0.24);
    await builder.fill("");
  });
}

async function runWorkspace(target, seconds, text) {
  await runTimed(seconds, async () => {
    await hideCaption(target);
    await click(target, target.getByRole("button", { name: "Create", exact: true }));
    await setCaption(target, text, seconds);
    await point(target, target.getByRole("textbox", { name: "Offer title", exact: true }));
    await wait(target, seconds * 0.26);
    await click(target, target.getByRole("button", { name: "Offers", exact: true }));
    const offer = target.locator("article").filter({ hasText: "ClauseFlow release evidence dossier" });
    const summary = offer.locator("summary");
    await click(target, summary);
    await wait(target, seconds * 0.28);
  });
}

async function runClose(target, seconds, text) {
  await runTimed(seconds, async () => {
    await hideCaption(target);
    await click(target, target.getByRole("button", { name: "Dashboard", exact: true }));
    await target.evaluate(() => window.scrollTo({ top: 0, behavior: "smooth" }));
    await setCaption(target, text, seconds * 0.48);
    await point(target, target.locator(".heroProof"));
    await wait(target, seconds * 0.14);
    await point(target, target.getByRole("region", { name: "Protocol summary", exact: true }));
    await wait(target, seconds * 0.14);
    await hideCaption(target);
    await showIntro(target, text, seconds * 0.52);
    await target.evaluate(() => {
      const proof = document.querySelector("#cf-demo-intro .proof");
      if (proof) proof.textContent = "clauseflow-two.vercel.app  |  github.com/tanphung/ClauseFlow";
    });
    await wait(target, seconds * 0.38);
  });
}
