// ===== BIZ OA Counter — โค้ดจริง (แก้ที่นี่ แล้ว push ขึ้น GitHub ทุกเครื่องได้เลย) =====
console.log('%c[BIZ OA] content script ทำงานแล้ว v2.8 (จับฟองข้อความ)', 'color:#06C755;font-weight:bold');
(() => {
  const APP = 'http://127.0.0.1:47321';
  const chatInfo = () => {
    const m = location.pathname.match(/^\/([^/]+)\/chat\/([^/?#]+)/);
    if (!m) return null;
    // ชื่อลูกค้า = <h4> ในแถบ .sub-header
    let name = '';
    const h = document.querySelector('.sub-header h4, .sub-header .text-truncate');
    if (h && h.innerText.trim()) name = h.innerText.trim().slice(0, 80);
    // ชื่อไลน์ OA = .account-name ในหัวหน้าต่าง
    let oaName = '';
    const a = document.querySelector('.account-name');
    if (a && a.innerText.trim()) oaName = a.innerText.trim().slice(0, 80);
    return { oa: m[1], chat: m[2], name, oaName };
  };
  const qKey = 'kbz_oa_queue';
  // ส่งผ่าน service worker (ยิงตรงจากหน้าเว็บไป 127.0.0.1 ไม่ได้ใน Chrome ใหม่)
  function sendSW(type, extra) { return new Promise((res, rej) => { try { chrome.runtime.sendMessage(Object.assign({ type }, extra || {}), (r) => { if (chrome.runtime.lastError || !r || !r.ok) rej(new Error('sw')); else res(r); }); } catch (e) { rej(e); } }); }
  async function post(it) { await sendSW('oa-reply', { item: it }); }
  async function flush() { let q = []; try { q = JSON.parse(localStorage.getItem(qKey) || '[]'); } catch (e) {} if (!q.length) return; const keep = []; for (const it of q) { try { await post(it); } catch (e) { keep.push(it); } } try { localStorage.setItem(qKey, JSON.stringify(keep.slice(-300))); } catch (e) {} }
  function record(info) {
    const now = Date.now();
    const it = { oa: info.oa, chat: info.chat, name: info.name, oaName: info.oaName || '', at: now };
    console.log('[BIZ OA] ✓ นับแชท (เราส่ง)', info.chat); post(it).then(flush).catch(() => { let q = []; try { q = JSON.parse(localStorage.getItem(qKey) || '[]'); } catch (e) {} q.push(it); try { localStorage.setItem(qKey, JSON.stringify(q.slice(-300))); } catch (e) {} kickRetry(); }); }
  let retryT = null;
  function kickRetry(){ if(retryT) return; retryT=setInterval(async()=>{ let q=[]; try{q=JSON.parse(localStorage.getItem(qKey)||'[]')}catch(e){} if(!q.length){clearInterval(retryT);retryT=null;return;} await flush(); },5000); }

  // ฟองที่ "เราส่ง" = อยู่ในกล่อง .chat-reverse (ของลูกค้าไม่มี)
  // คืนฟอง .chat-item.baloon ที่ "เราส่ง" (อยู่ในกล่อง .chat.chat-reverse) จาก node ที่เพิ่งเพิ่ม — null ถ้าไม่ใช่
  const ourBubble = (node) => {
    if (!(node instanceof HTMLElement)) return null;
    // node เป็นฟองเอง / มีฟองข้างใน / เป็นกล่องที่มีฟอง
    let bubble = node.matches && node.matches('.chat-item.baloon') ? node : (node.querySelector && node.querySelector('.chat-item.baloon'));
    if (!bubble && node.closest) bubble = node.closest('.chat-item.baloon');
    if (!bubble) return null;
    const wrap = bubble.closest('.chat');
    return (wrap && wrap.classList.contains('chat-reverse')) ? bubble : null;
  };

  // จับ "เพิ่งกดส่ง" — ฟองใหม่จะนับได้ก็ต่อเมื่อมีการกดส่งข้อความจริงเมื่อไม่กี่วินาทีก่อน
  let lastSendAt = 0;
  const markSend = () => { lastSendAt = Date.now(); };
  document.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) markSend(); }, true);
  document.addEventListener('click', (e) => {
    const b = e.target && e.target.closest && e.target.closest('button, [role="button"], [class*="end"], [class*="Send"], [class*="submit"]');
    if (b) { const lb = ((b.innerText || '') + ' ' + (b.getAttribute('aria-label') || '') + ' ' + (b.className || '')).toLowerCase(); if (/send|ส่ง|submit/.test(lb)) markSend(); }
  }, true);

  let armed = false;   // เริ่มนับหลังหน้าโหลดนิ่งแล้ว (กันนับฟองเก่าที่โหลดมาตอนเปิดแชท)
  const obs = new MutationObserver((muts) => {
    if (!armed) return;
    for (const mu of muts) {
      for (const n of mu.addedNodes) {
        const added = ourBubble(n);
        if (added) {
          // ต้องเป็นฟองท้ายสุด (ฟองเก่าที่ LINE โหลดกลับมาจะไม่ใช่ตัวสุดท้าย) + เพิ่งกดส่งจริงใน 6 วิ
          const bubbles = document.querySelectorAll('.chat.chat-reverse .chat-item.baloon');
          const last = bubbles[bubbles.length - 1];
          const justSent = Date.now() - lastSendAt < 6000;
          if (last === added && justSent) { const info = chatInfo(); if (info) { record(info); return; } }
        }
      }
    }
  });
  const start = () => {
    obs.observe(document.body, { childList: true, subtree: true });
    setTimeout(() => { armed = true; console.log('[BIZ OA] เริ่มเฝ้าฟองข้อความแล้ว'); }, 1500);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
  // เปลี่ยนแชท → reset armed สั้นๆ กันนับฟองเก่าของแชทใหม่
  let lastPath = location.pathname;
  setInterval(() => { if (location.pathname !== lastPath) { lastPath = location.pathname; armed = false; lastSendAt = 0; setTimeout(() => { armed = true; }, 2000); } }, 400);

  // แถบเตือนมุมขวาล่าง เมื่อแอปปิด (แชทจะถูกเก็บไว้แต่ยังไม่ถูกนับ)
  let warnEl = null, appWasDown = false;
  function setAppStatus(ok) {
    if (ok) {
      if (warnEl) { warnEl.remove(); warnEl = null; }
      if (appWasDown) { appWasDown = false; flush(); kickRetry(); }   // แอปกลับมา → ส่งของค้างทันที + เร่งจนเกลี้ยง
      return;
    }
    appWasDown = true;
    let q = []; try { q = JSON.parse(localStorage.getItem(qKey) || '[]'); } catch (e) {}
    if (!warnEl) {
      warnEl = document.createElement('div');
      warnEl.style.cssText = 'position:fixed;right:16px;bottom:16px;z-index:2147483647;background:#7c2d12;color:#fff;padding:11px 15px;border-radius:12px;font:700 13px "Segoe UI",Tahoma;box-shadow:0 8px 24px rgba(0,0,0,.4);border:1px solid #f59e0b;max-width:280px;line-height:1.5';
      document.body.appendChild(warnEl);
    }
    warnEl.innerHTML = '⚠️ แอป BIZ Checker ยังไม่เปิด (หรือยังไม่ล็อกอิน)<br><span style="font-weight:400;opacity:.9">แชทที่ตอบจะถูกเก็บไว้ ' + (q.length ? q.length + ' รายการ ' : '') + 'และนับให้เมื่อเปิดแอป</span>';
  }
  let pingN = 0;
  // ===== จับการกดปุ่มสถานะแชท: ต้องดำเนินการ / ดำเนินการแล้ว =====
  const actLabel = (el) => { const t = (el.innerText || '').trim(); if (t === 'ดำเนินการแล้ว') return 'done'; if (t === 'ต้องดำเนินการ') return 'todo'; return null; };
  document.addEventListener('click', (e) => {
    const b = e.target && e.target.closest && e.target.closest('a.btn, button.btn');
    if (!b) return;
    const act = actLabel(b); if (!act) return;
    const info = chatInfo(); if (!info) return;   // ต้องเปิดแชทอยู่ (มี chat_id)
    // ส่งสถานะที่ "กด" (todo/done) + ข้อมูลแชท
    const item = { type: 'action', action: act, oa: info.oa, chat: info.chat, name: info.name, oaName: info.oaName || '', at: Date.now() };
    console.log('[BIZ OA] ✓ กด' + (act === 'done' ? 'ดำเนินการแล้ว' : 'ต้องดำเนินการ'), info.chat);
    sendSW('oa-action', { item }).catch(() => { let q = []; try { q = JSON.parse(localStorage.getItem('kbz_oa_actq') || '[]'); } catch (er) {} q.push(item); try { localStorage.setItem('kbz_oa_actq', JSON.stringify(q.slice(-300))); } catch (er) {} });
  }, true);

  const ping = () => sendSW('oa-ping').then(d => setAppStatus(d && d.user)).catch(() => setAppStatus(false));
  ping();
  // ช่วงแรกเช็คถี่ (ทุก 4 วิ) เผื่อแอปเพิ่งเปิด/คอมเพิ่งบูต แล้วค่อยผ่อนเป็น 15 วิ
  const fast = setInterval(() => { ping(); if (++pingN > 15) { clearInterval(fast); setInterval(ping, 15000); } }, 4000);
  // กลับมาโฟกัสแท็บ chat.line.biz → เช็คแอปทันที
  document.addEventListener('visibilitychange', () => { if (!document.hidden) ping(); });
  window.addEventListener('focus', () => ping());
})();
