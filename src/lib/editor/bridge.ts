import type { FieldMappings, WeddingDetails, WeddingEvent } from "../data/types";

export interface BridgeOptions {
  token: string;
  details: WeddingDetails;
  mappings: FieldMappings;
  events: WeddingEvent[];
  selectMode: boolean;
  /** Published/exported pages keep countdown, music and accent logic but no editor messaging. */
  publicMode?: boolean;
}

function jsString(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026");
}

/** Script injected into the sandboxed preview document. It never runs in the studio origin. */
export function bridgeScript(options: BridgeOptions): string {
  const data = jsString({
    token: options.token,
    details: options.details,
    mappings: options.mappings,
    events: options.events,
    selectMode: options.selectMode,
  });
  return `
(function () {
  const config = ${data};
  const TOKEN = config.token;
  let selecting = config.selectMode;

  function selectorFor(el) {
    if (el.id) return '#' + String(el.id).replace(/[^a-zA-Z0-9_-]/g, function (c) { return '\\\\' + c; });
    const parts = [];
    let node = el;
    while (node && node.nodeName.toLowerCase() !== 'html') {
      const tag = node.nodeName.toLowerCase();
      const parent = node.parentElement;
      if (parent) {
        const same = Array.prototype.filter.call(parent.children, function (child) { return child.nodeName.toLowerCase() === tag; });
        parts.unshift(same.length > 1 ? tag + ':nth-of-type(' + (same.indexOf(node) + 1) + ')' : tag);
      } else parts.unshift(tag);
      node = parent;
    }
    return parts.join(' > ');
  }

  function valueFor(key) {
    const detail = config.details || {};
    if (key.indexOf('event.') === 0) {
      const parts = key.split('.');
      const event = (config.events || [])[Number(parts[1]) - 1] || {};
      const field = parts[2] === 'mapUrl' ? 'mapUrl' : parts[2] === 'imageUrl' ? 'imageUrl' : parts[2] === 'location' ? 'location' : parts[2];
      return event[field] || '';
    }
    return detail[key] || '';
  }

  function applyMappings() {
    Object.keys(config.mappings || {}).forEach(function (key) {
      const value = valueFor(key);
      if (!value) return;
      const selector = config.mappings[key];
      let node;
      try { node = document.querySelector(selector); } catch (e) { return; }
      if (!node) return;
      if (['mapsUrl', 'musicUrl', 'instagramUrl', 'imageUrl', 'mapUrl'].indexOf(key) >= 0 || key.indexOf('ImageUrl') >= 0 || /^event\\.\\d+\\.(mapUrl|imageUrl)$/.test(key)) {
        if (node.hasAttribute('src')) node.setAttribute('src', value);
        else node.setAttribute('href', value);
      } else if (node.textContent) {
        node.textContent = value;
      }
    });
  }

  function countdownText(iso, heading) {
    const target = new Date(iso).getTime();
    if (!isFinite(target)) return '';
    let remaining = Math.max(0, target - Date.now());
    const days = Math.floor(remaining / 86400000);
    remaining %= 86400000;
    const hours = Math.floor(remaining / 3600000);
    remaining %= 3600000;
    const mins = Math.floor(remaining / 60000);
    const secs = Math.floor((remaining % 60000) / 1000);
    return String(days).padStart(2, '0') + ':' + String(hours).padStart(2, '0') + ':' + String(mins).padStart(2, '0') + ':' + String(secs).padStart(2, '0');
  }

  function startCountdown() {
    const date = config.details.weddingDate;
    const time = config.details.weddingTime || '00:00';
    if (!date) return;
    const iso = date + 'T' + (time.length === 5 ? time + ':00' : time);
    window.__wisTarget = iso;
    const headingNode = document.querySelector(config.mappings.countdownHeading || '#footer_title, #countdownTitle');
    if (headingNode && config.details.countdownHeading) headingNode.textContent = config.details.countdownHeading;
    const valueNode = document.querySelector('#targetDate');
    const dayNode = document.querySelector('#cdDays');
    const update = function () {
      const value = countdownText(iso);
      if (valueNode && !valueNode.querySelector('*')) valueNode.textContent = value;
      if (dayNode) {
        const parts = value.split(':');
        const hourNode = document.querySelector('#cdHours');
        const minNode = document.querySelector('#cdMins');
        const secNode = document.querySelector('#cdSecs');
        if (dayNode) dayNode.textContent = parts[0];
        if (hourNode) hourNode.textContent = parts[1];
        if (minNode) minNode.textContent = parts[2];
        if (secNode) secNode.textContent = parts[3];
      }
    };
    update();
    window.setInterval(update, 1000);
  }

  function setupMusic() {
    const url = config.details.musicUrl;
    if (!url) return;
    let audio = document.querySelector('#bgMusic, audio');
    if (!audio) {
      audio = document.createElement('audio');
      audio.id = 'bgMusic';
      audio.loop = true;
      document.body.appendChild(audio);
    }
    audio.setAttribute('src', url);
    window.setTimeout(function () {
      if (document.querySelector('[data-wis-music-button]')) return;
      const button = document.createElement('button');
      button.setAttribute('data-wis-music-button', '');
      button.textContent = '♪ Play music';
      button.setAttribute('aria-label', 'Play wedding music');
      button.style.cssText = 'position:fixed;right:16px;bottom:16px;z-index:99999;padding:10px 14px;border-radius:999px;border:0;background:#4b2146;color:#fff;font:600 13px sans-serif;box-shadow:0 8px 24px rgba(0,0,0,.25)';
      button.addEventListener('click', function () {
        if (audio.paused) { audio.play().then(function () { button.textContent = '❚❚ Pause music'; }).catch(function () { button.textContent = 'Tap to play'; }); }
        else { audio.pause(); button.textContent = '♪ Play music'; }
      });
      document.body.appendChild(button);
    }, 1200);
  }

  function applyAccent() {
    const color = config.details.accentColor;
    if (!color) return;
    document.documentElement.style.setProperty('--wis-accent', color);
    let style = document.querySelector('style[data-wis-accent]');
    if (!style) { style = document.createElement('style'); style.setAttribute('data-wis-accent', ''); document.head.appendChild(style); }
    style.textContent = ':root{--primary:' + color + '!important;--accent:' + color + '!important;}a{color:' + color + ';}';
  }

  ${options.publicMode ? "" : `
  window.addEventListener('message', function (event) {
    const data = event.data;
    if (!data || data.wis !== TOKEN) return;
    if (data.action === 'select-mode') selecting = !!data.value;
    if (data.action === 'refresh') applyMappings();
  });

  document.addEventListener('click', function (event) {
    if (!selecting) return;
    const target = event.target;
    if (!target || !target.closest) return;
    const el = target.closest('p,h1,h2,h3,h4,h5,h6,span,a,li,button,figcaption');
    if (!el) return;
    event.preventDefault();
    event.stopPropagation();
    window.parent.postMessage({ wis: TOKEN, type: 'wis:selection', selector: selectorFor(el), text: (el.textContent || '').replace(/\\s+/g, ' ').trim().slice(0, 200) }, '*');
  }, true);
  `}

  applyMappings();
  startCountdown();
  setupMusic();
  applyAccent();
})();
`;
}
