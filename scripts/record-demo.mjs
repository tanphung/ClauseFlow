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
const page = await context.newPage();
const startedAt = Date.now();

await page.goto("https://clauseflow-two.vercel.app", { waitUntil: "domcontentloaded", timeout: 60_000 });
await page.getByRole("heading", { name: "Public on-chain agreement dashboard", exact: true }).waitFor({ state: "visible", timeout: 30_000 });
await page.getByRole("region", { name: "Protocol summary", exact: true }).getByText("0.015", { exact: true }).waitFor({ state: "visible", timeout: 30_000 });
await installRecordingOverlay(page);
const preRollSeconds = (Date.now() - startedAt) / 1000;

await runTimed(duration("intro"), async () => {
  await showIntro(page, caption("intro"));
  await wait(page, Math.max(0.5, duration("intro") - 0.5));
  await hideIntro(page);
});

await runDashboard(page, duration("dashboard"), caption("dashboard"));
await runPayment(page, duration("payment"), caption("payment"));
await runRefund(page, duration("refund"), caption("refund"));
await runDiscovery(page, duration("discovery"), caption("discovery"));
await runWorkspace(page, duration("workspace"), caption("workspace"));
await runClose(page, duration("close"), caption("close"));

const video = page.video();
await page.close();
await context.close();
if (!video) throw new Error("Playwright did not create a recording");
await video.saveAs(outputPath);
await browser.close();
writeFileSync(metadataPath, JSON.stringify({ preRollSeconds, sceneDurationSeconds: scenes.reduce((sum, scene) => sum + Number(scene.durationSeconds), 0) }, null, 2));
console.log(`DEMO_RECORDING_OK video=${outputPath} metadata=${metadataPath}`);

async function installRecordingOverlay(target) {
  await target.evaluate(() => {
    const style = document.createElement("style");
    style.textContent = `
      #cf-demo-caption { position: fixed; left: 50%; bottom: 34px; z-index: 2147483646; transform: translateX(-50%) translateY(16px); width: min(920px, calc(100vw - 96px)); padding: 16px 22px; color: #f7fbf8; background: rgba(9, 48, 40, .94); border: 1px solid rgba(255,255,255,.18); border-radius: 8px; box-shadow: 0 16px 44px rgba(6,28,23,.25); font: 700 22px/1.35 Arial, sans-serif; letter-spacing: 0; text-align: center; opacity: 0; transition: opacity .28s ease, transform .28s ease; pointer-events: none; }
      #cf-demo-caption.visible { opacity: 1; transform: translateX(-50%) translateY(0); }
      #cf-demo-cursor { position: fixed; left: -100px; top: -100px; z-index: 2147483647; width: 20px; height: 20px; margin: -10px 0 0 -10px; border: 2px solid #fff; border-radius: 50%; background: #f25e4f; box-shadow: 0 2px 12px rgba(0,0,0,.35); pointer-events: none; transition: transform .12s ease; }
      #cf-demo-intro { position: fixed; inset: 0; z-index: 2147483645; display: grid; place-items: center; color: #fff; background: rgba(7,38,32,.86); backdrop-filter: blur(6px); opacity: 0; transition: opacity .35s ease; pointer-events: none; }
      #cf-demo-intro.visible { opacity: 1; }
      #cf-demo-intro .inner { width: min(1040px, calc(100vw - 160px)); text-align: center; }
      #cf-demo-intro .mark { display: inline-grid; place-items: center; width: 68px; height: 68px; margin-bottom: 25px; border-radius: 12px; color: #0b483c; background: #fff; font: 800 34px/1 Arial, sans-serif; }
      #cf-demo-intro h2 { margin: 0 0 20px; color: #fff; font: 800 68px/1.05 Arial, sans-serif; letter-spacing: 0; }
      #cf-demo-intro p { margin: 0 auto; max-width: 940px; color: #d9ebe4; font: 500 30px/1.4 Arial, sans-serif; letter-spacing: 0; }
      #cf-demo-intro .proof { margin-top: 30px; color: #9ed8c7; font: 700 18px/1.4 Arial, sans-serif; text-transform: uppercase; }
    `;
    document.head.append(style);
    const captionNode = document.createElement("div");
    captionNode.id = "cf-demo-caption";
    const cursor = document.createElement("div");
    cursor.id = "cf-demo-cursor";
    const intro = document.createElement("div");
    intro.id = "cf-demo-intro";
    intro.innerHTML = '<div class="inner"><div class="mark">C</div><h2>ClauseFlow</h2><p></p><div class="proof">Live on GenLayer Bradbury</div></div>';
    document.body.append(captionNode, cursor, intro);
    document.addEventListener("mousemove", (event) => {
      cursor.style.left = `${event.clientX}px`;
      cursor.style.top = `${event.clientY}px`;
    });
    document.addEventListener("mousedown", () => { cursor.style.transform = "scale(.72)"; });
    document.addEventListener("mouseup", () => { cursor.style.transform = "scale(1)"; });
  });
}

async function setCaption(target, text) {
  await target.evaluate((value) => {
    const node = document.querySelector("#cf-demo-caption");
    if (!node) return;
    node.textContent = value;
    node.classList.add("visible");
  }, text);
}

async function showIntro(target, text) {
  await target.evaluate((value) => {
    const intro = document.querySelector("#cf-demo-intro");
    if (!intro) return;
    document.querySelector("#cf-demo-caption")?.classList.remove("visible");
    const cursor = document.querySelector("#cf-demo-cursor");
    if (cursor) cursor.style.opacity = "0";
    const paragraph = intro.querySelector("p");
    if (paragraph) paragraph.textContent = value;
    intro.classList.add("visible");
  }, text);
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
  await locator.scrollIntoViewIfNeeded();
  const box = await locator.boundingBox();
  if (!box) throw new Error("Demo target is not visible");
  await target.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 18 });
  await target.waitForTimeout(220);
  await locator.click();
  await target.waitForTimeout(350);
}

async function point(target, locator) {
  await locator.scrollIntoViewIfNeeded();
  const box = await locator.boundingBox();
  if (!box) return;
  await target.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 22 });
}

async function wait(target, seconds) {
  await target.waitForTimeout(Math.max(250, seconds * 1_000));
}

async function runTimed(seconds, action) {
  const started = Date.now();
  await action();
  const remaining = seconds * 1_000 - (Date.now() - started);
  if (remaining > 0) await page.waitForTimeout(remaining);
}

async function runDashboard(target, seconds, text) {
  await runTimed(seconds, async () => {
    await setCaption(target, text);
    await point(target, target.getByRole("region", { name: "Protocol summary", exact: true }));
    await wait(target, seconds * 0.35);
    const rows = target.locator("button.ledgerRow");
    await point(target, rows.first());
    await wait(target, seconds * 0.35);
  });
}

async function runPayment(target, seconds, text) {
  await runTimed(seconds, async () => {
    const row = target.locator("button.ledgerRow").filter({ hasText: "ClauseFlow verified payment flow" });
    await click(target, row);
    await target.evaluate(() => window.scrollTo({ top: 0, behavior: "smooth" }));
    await setCaption(target, text);
    await wait(target, seconds * 0.18);
    await click(target, target.getByRole("tab", { name: "Evidence & review", exact: true }));
    await point(target, target.getByText("75/100", { exact: true }));
    await wait(target, seconds * 0.28);
    await click(target, target.getByRole("tab", { name: "On-chain history", exact: true }));
    await wait(target, seconds * 0.24);
  });
}

async function runRefund(target, seconds, text) {
  await runTimed(seconds, async () => {
    await click(target, target.getByRole("button", { name: "Dashboard", exact: true }));
    const row = target.locator("button.ledgerRow").filter({ hasText: "Mochi-Game accessibility audit agreement" });
    await click(target, row);
    await target.evaluate(() => window.scrollTo({ top: 0, behavior: "smooth" }));
    await setCaption(target, text);
    await wait(target, seconds * 0.16);
    await click(target, target.getByRole("tab", { name: "Evidence & review", exact: true }));
    await point(target, target.getByText("50/100", { exact: true }));
    await wait(target, seconds * 0.28);
    await click(target, target.getByRole("tab", { name: "On-chain history", exact: true }));
    await wait(target, seconds * 0.22);
  });
}

async function runDiscovery(target, seconds, text) {
  await runTimed(seconds, async () => {
    await click(target, target.getByRole("button", { name: "Dashboard", exact: true }));
    await setCaption(target, text);
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
    await click(target, target.getByRole("button", { name: "Create", exact: true }));
    await setCaption(target, text);
    await point(target, target.getByRole("textbox", { name: "Offer title", exact: true }));
    await wait(target, seconds * 0.26);
    await click(target, target.getByRole("button", { name: "Offers", exact: true }));
    const offer = target.locator("article").filter({ hasText: "ClauseFlow verified payment flow" });
    const summary = offer.locator("summary");
    await click(target, summary);
    await wait(target, seconds * 0.28);
  });
}

async function runClose(target, seconds, text) {
  await runTimed(seconds, async () => {
    await click(target, target.getByRole("button", { name: "Dashboard", exact: true }));
    await target.evaluate(() => window.scrollTo({ top: 0, behavior: "smooth" }));
    await showIntro(target, text);
    await target.evaluate(() => {
      const proof = document.querySelector("#cf-demo-intro .proof");
      if (proof) proof.textContent = "clauseflow-two.vercel.app  |  github.com/tanphung/ClauseFlow";
    });
  });
}
