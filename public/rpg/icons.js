// Рисованные значки ресурсов (SVG) — вместо эмодзи, которые на части компьютеров видны как квадратики
const S = (body) => `<svg class="ico" viewBox="0 0 24 24" width="1.25em" height="1.25em" aria-hidden="true">${body}</svg>`;
const logs = (a, b) => `<rect x="3" y="13" width="18" height="6" rx="3" fill="${a}"/><rect x="5" y="7" width="16" height="6" rx="3" fill="${a}"/><circle cx="5" cy="16" r="3" fill="${b}"/><circle cx="7" cy="10" r="3" fill="${b}"/><circle cx="5" cy="16" r="1.2" fill="none" stroke="${a}" stroke-width=".8"/><circle cx="7" cy="10" r="1.2" fill="none" stroke="${a}" stroke-width=".8"/>`;
const rock = (a, b, spots) => `<path d="M3 17 L6 9 L11 6 L17 7 L21 12 L19 18 L9 19 Z" fill="${a}" stroke="${b}" stroke-width="1"/><path d="M6 9 L11 12 L17 7 M11 12 L9 19" fill="none" stroke="${b}" stroke-width=".8" opacity=".6"/>${spots ? `<circle cx="14" cy="13" r="1.6" fill="${spots}"/><circle cx="9" cy="15" r="1.1" fill="${spots}"/><circle cx="16" cy="10" r="1" fill="${spots}"/>` : ''}`;
const ingot = (a, b) => `<path d="M3 17 L6 10 L18 10 L21 17 Z" fill="${a}" stroke="${b}" stroke-width="1"/><path d="M6 10 L8 7 L20 7 L18 10" fill="${b}" opacity=".5"/><path d="M7 12 L17 12" stroke="#fff" stroke-width=".8" opacity=".6"/>`;
const amph = (a, b) => `<path d="M10 3 h4 v3 c3 2 4 6 3 10 c-1 3 -3 5 -5 5 c-2 0 -4 -2 -5 -5 c-1 -4 0 -8 3 -10 z" fill="${a}" stroke="${b}" stroke-width="1"/><path d="M9 6 c-3 0 -3 4 -1 5 M15 6 c3 0 3 4 1 5" fill="none" stroke="${b}" stroke-width="1.2"/>`;
const fish = (a, b) => `<path d="M3 12 c4 -6 11 -6 15 0 c-4 6 -11 6 -15 0 z" fill="${a}" stroke="${b}" stroke-width=".8"/><path d="M18 12 L22 8 L22 16 Z" fill="${b}"/><circle cx="7" cy="11" r="1" fill="#111"/>`;
const blob = (a, b) => `<path d="M4 15 c0 -5 4 -8 8 -8 c5 0 8 3 8 7 c0 4 -4 5 -8 5 c-5 0 -8 0 -8 -4 z" fill="${a}" stroke="${b}" stroke-width="1"/>`;
const cluster = (a, b) => [[12, 8], [9, 12], [15, 12], [12, 15], [9, 17], [15, 17], [12, 20]].map(([x, y]) => `<circle cx="${x}" cy="${y - 2}" r="2.7" fill="${a}" stroke="${b}" stroke-width=".6"/>`).join('') + `<path d="M12 5 L12 2 M12 4 L15 3" stroke="#4a6a2a" stroke-width="1.2"/>`;
const ICONS = {
  wood: logs('#8a5a32', '#d8b07a'), cedar: logs('#7a3a22', '#c88a5a'),
  stone: rock('#9a948a', '#5a564e'), marble: rock('#eeeae0', '#a8a294'), iron_ore: rock('#7a7068', '#4a423a', '#b8643a'), silver_ore: rock('#7a7a80', '#4a4a50', '#e8e8f0'),
  clay: blob('#b8683a', '#7a4022'),
  hide: `<path d="M5 5 c3 2 4 1 7 0 c3 1 4 2 7 0 c-1 4 1 6 0 9 c1 3 -1 4 0 6 c-3 -1 -4 0 -7 0 c-3 0 -4 -1 -7 0 c1 -2 -1 -3 0 -6 c-1 -3 1 -5 0 -9 z" fill="#8a5a3a" stroke="#5a3a22" stroke-width="1"/>`,
  leather: `<rect x="4" y="5" width="16" height="14" rx="2" fill="#7a4a2a" stroke="#4a2a14"/><path d="M4 9 h16 M4 15 h16" stroke="#a8784a" stroke-width="1" stroke-dasharray="1.5 1.5"/>`,
  meat: `<path d="M13 4 c5 0 8 4 7 8 c-1 4 -5 6 -9 5 l-3 3 c-1 1 -3 1 -3 -1 c-2 0 -2 -2 -1 -3 l3 -3 c-1 -5 2 -9 6 -9 z" fill="#c0503a" stroke="#7a2a1a"/><circle cx="5" cy="19" r="1.6" fill="#f0e8d8"/>`,
  wheat: `<path d="M12 22 L12 6" stroke="#b8902a" stroke-width="1.5"/>` + [6, 9, 12, 15].map((y) => `<ellipse cx="9.5" cy="${y}" rx="2.3" ry="1.3" transform="rotate(-35 9.5 ${y})" fill="#e8c050"/><ellipse cx="14.5" cy="${y}" rx="2.3" ry="1.3" transform="rotate(35 14.5 ${y})" fill="#e8c050"/>`).join('') + `<ellipse cx="12" cy="4" rx="1.3" ry="2.2" fill="#e8c050"/>`,
  olives: `<path d="M6 6 c4 0 8 2 12 8" stroke="#5a6a2a" stroke-width="1.3" fill="none"/><ellipse cx="9" cy="13" rx="3" ry="4" fill="#556b2f" stroke="#2a3a14"/><ellipse cx="15" cy="16" rx="3" ry="4" fill="#3a4a1a" stroke="#1a2a0a"/><path d="M11 6 c2 -3 5 -3 6 -2 c-2 2 -4 3 -6 2 z" fill="#7a9a4a"/>`,
  grapes: cluster('#6a2a6a', '#3a0a3a'),
  murex: `<path d="M12 3 L18 12 L15 20 L9 20 L6 12 Z" fill="#e8d0b8" stroke="#8a6a50"/><path d="M8 11 L16 11 M8.5 15 L15.5 15 M12 3 L12 20" stroke="#a8786a" stroke-width=".8"/><path d="M6 12 L3 10 M18 12 L21 10 M7 16 L4 16 M17 16 L20 16" stroke="#8a6a50" stroke-width="1.2"/>`,
  papyrus: `<rect x="5" y="6" width="14" height="12" fill="#e8d8a8" stroke="#8a7a4a"/><rect x="3" y="5" width="3" height="14" rx="1.5" fill="#c8b07a" stroke="#7a6a3a"/><rect x="18" y="5" width="3" height="14" rx="1.5" fill="#c8b07a" stroke="#7a6a3a"/><path d="M8 9 h8 M8 12 h7 M8 15 h8" stroke="#6a5a3a" stroke-width=".8"/>`,
  linen: `<rect x="6" y="4" width="12" height="3" rx="1" fill="#8a6a44"/><rect x="6" y="17" width="12" height="3" rx="1" fill="#8a6a44"/><rect x="8" y="7" width="8" height="10" fill="#ece4d0"/><path d="M8 9 h8 M8 11 h8 M8 13 h8 M8 15 h8" stroke="#b8ac90" stroke-width=".7"/>`,
  plank: `<rect x="2" y="6" width="20" height="4" fill="#c89a5a" stroke="#7a5a2a" stroke-width=".8"/><rect x="2" y="10.5" width="20" height="4" fill="#b8884a" stroke="#7a5a2a" stroke-width=".8"/><rect x="2" y="15" width="20" height="4" fill="#d0a464" stroke="#7a5a2a" stroke-width=".8"/>`,
  brick: `<rect x="3" y="5" width="8.5" height="4" fill="#b8503a" stroke="#6a2a1a" stroke-width=".7"/><rect x="12.5" y="5" width="8.5" height="4" fill="#a8483a" stroke="#6a2a1a" stroke-width=".7"/><rect x="7" y="10" width="9" height="4" fill="#c05a40" stroke="#6a2a1a" stroke-width=".7"/><rect x="3" y="15" width="8.5" height="4" fill="#a8483a" stroke="#6a2a1a" stroke-width=".7"/><rect x="12.5" y="15" width="8.5" height="4" fill="#b8503a" stroke="#6a2a1a" stroke-width=".7"/>`,
  iron: ingot('#8a8e94', '#4a4e54'), silver: ingot('#dcdee6', '#8a8c94'), gold: ingot('#e8c040', '#9a7a1a'),
  purple: amph('#7a1a6a', '#3a0a32'),
  bread: `<path d="M3 15 c0 -6 5 -9 9 -9 c4 0 9 3 9 9 c0 2 -1 3 -3 3 h-12 c-2 0 -3 -1 -3 -3 z" fill="#c8883a" stroke="#7a4a1a"/><path d="M8 9 l2 3 M12 8 l1 4 M16 9 l-1 3" stroke="#f0d090" stroke-width="1.2"/>`,
  oil: amph('#d8b040', '#7a5a1a'), wine: amph('#8a1a2a', '#4a0a14'), amphora: amph('#b86a3a', '#6a3a1a'), artifact: amph('#3a7a7a', '#d8b040'),
  arrow: `<path d="M4 20 L19 5" stroke="#8a6a44" stroke-width="1.6"/><path d="M19 5 L14 6 L18 10 Z" fill="#6a6a70"/><path d="M4 20 L4 15 M4 20 L9 20 M6 18 L6 14 M6 18 L10 18" stroke="#d8d0c0" stroke-width="1.2"/>`,
  pilum: `<path d="M3 21 L15 9" stroke="#8a6a44" stroke-width="2"/><path d="M15 9 L20 4" stroke="#8a8e94" stroke-width="1.2"/><path d="M20 4 L18 3 L21 2 L21 6 Z" fill="#6a6e74"/>`,
  bandage: `<rect x="4" y="8" width="16" height="8" rx="4" fill="#f4eee0" stroke="#a89e88"/><circle cx="8" cy="12" r="2.5" fill="#e8e0cc" stroke="#a89e88"/><rect x="11" y="10.5" width="6" height="3" fill="#c0503a"/>`,
  gem: `<path d="M5 9 L9 4 L15 4 L19 9 L12 20 Z" fill="#4ab0c8" stroke="#1a5a7a"/><path d="M5 9 h14 M9 4 L12 9 L15 4 M12 9 L12 20" stroke="#bfe8f0" stroke-width=".7"/>`,
  f_sardine: fish('#a8b8c8', '#5a6a7a'), f_mackerel: fish('#5a8a9a', '#2a4a5a'), f_seabass: fish('#b0b8b8', '#5a6262'), f_dentex: fish('#d88a8a', '#8a4a4a'), f_grouper: fish('#8a6a4a', '#4a3a22'), f_tuna: fish('#3a5a8a', '#1a2a4a'), f_sturgeon: fish('#7a7a6a', '#3a3a32'),
  f_swordfish: fish('#5a6a8a', '#2a3a5a') + `<path d="M3 12 L-2 11.5" stroke="#2a3a5a" stroke-width="1.2"/>`,
  calamus: `<path d="M8 22 L9 6 M12 22 L12 3 M16 22 L15 7 M5 22 L6 11 M19 22 L18 10" stroke="#8a9a4a" stroke-width="1.6" stroke-linecap="round"/><ellipse cx="9" cy="5" rx="1.3" ry="3" fill="#7a5a32"/><ellipse cx="12" cy="3" rx="1.4" ry="3.2" fill="#6a4a28"/><ellipse cx="15" cy="6" rx="1.3" ry="3" fill="#7a5a32"/><path d="M4 20 h16" stroke="#c8b47a" stroke-width="1.8"/>`,
  croc_hide: `<path d="M3 7 c4 -2 14 -2 18 0 l-1 10 c-4 2 -12 2 -16 0 z" fill="#5e6e3a" stroke="#2e3a1a"/>` + [6, 10, 14, 18].map((x) => [9, 12.5].map((y) => `<rect x="${x - 1.4}" y="${y - 1.2}" width="2.8" height="2.4" rx=".6" fill="#7a8a4a" stroke="#3e4a22" stroke-width=".5"/>`).join('')).join(''),
  f_trout: fish('#9aa880', '#4a5a3a') + `<circle cx="10" cy="11" r=".6" fill="#c84a3a"/><circle cx="13" cy="12.5" r=".6" fill="#c84a3a"/>`,
  f_eel: `<path d="M2 13 c4 -5 7 3 11 -1 c3 -3 6 1 9 -2" stroke="#4a4a32" stroke-width="3" fill="none" stroke-linecap="round"/><circle cx="21" cy="10" r=".8" fill="#111"/>`,
  f_pike: `<path d="M2 12 c5 -4 13 -4 17 0 c-4 4 -12 4 -17 0 z" fill="#6a7a4a" stroke="#3a4a22" stroke-width=".8"/><path d="M19 12 L23 9 L23 15 Z" fill="#3a4a22"/><path d="M2 12 L6 11" stroke="#3a4a22"/><circle cx="5" cy="11" r=".8" fill="#111"/>`,
  f_moray: `<path d="M3 14 c3 -6 6 2 9 -3 c3 -5 6 2 9 -2" stroke="#6a7a2a" stroke-width="3.5" fill="none" stroke-linecap="round"/><circle cx="20" cy="9" r=".9" fill="#111"/>`,
  f_octopus: `<ellipse cx="12" cy="9" rx="6" ry="5.5" fill="#c86a6a" stroke="#7a3a3a"/>` + [-5, -2.5, 0, 2.5, 5].map((d) => `<path d="M${12 + d} 13 q${d * 0.5} 4 ${d * 0.8 + 1} 7" stroke="#c86a6a" stroke-width="1.8" fill="none" stroke-linecap="round"/>`).join('') + `<circle cx="10" cy="9" r="1" fill="#111"/><circle cx="14" cy="9" r="1" fill="#111"/>`,
};
export function icon(k) { const b = ICONS[k]; return b ? S(b) : ''; }
export const hasIcon = (k) => !!ICONS[k];
// значки снаряжения (по виду предмета)
const GI = {
  blade: `<path d="M12 2 L14 5 L14 15 L10 15 L10 5 Z" fill="#cfd6dc" stroke="#6a727a"/><rect x="6.5" y="15" width="11" height="2" rx="1" fill="#b8902a"/><rect x="11" y="17" width="2" height="4" fill="#6a4a2a"/><circle cx="12" cy="22" r="1.4" fill="#b8902a"/>`,
  knife: `<path d="M12 5 L14 8 L14 14 L10 14 L10 8 Z" fill="#cfd6dc" stroke="#6a727a"/><rect x="8" y="14" width="8" height="1.6" fill="#8a6a44"/><rect x="11" y="15.6" width="2" height="5" fill="#5a3a22"/>`,
  axe: `<path d="M8 21 L15 4" stroke="#8a6a44" stroke-width="2"/><path d="M12 6 c3 -2 7 -1 8 2 c-2 2 -5 3 -7 3 z" fill="#aab2ba" stroke="#5a626a"/>`,
  spear: `<path d="M5 21 L17 6" stroke="#8a6a44" stroke-width="1.8"/><path d="M17 6 L19 2 L20.5 5.5 Z" fill="#cfd6dc" stroke="#6a727a"/>`,
  bow: `<path d="M7 3 c9 4 9 14 0 18" fill="none" stroke="#8a5a32" stroke-width="2"/><path d="M7 3 L7 21" stroke="#e8e0c8" stroke-width=".8"/><path d="M5 12 L19 12 M19 12 L16 10 M19 12 L16 14" stroke="#6a5a4a" stroke-width="1.2"/>`,
  rod: `<path d="M4 21 L19 3" stroke="#8a6a44" stroke-width="1.6"/><path d="M19 3 Q22 10 18 16" stroke="#e8e8e8" stroke-width=".7" fill="none"/><circle cx="18" cy="16.5" r="1.2" fill="#c0503a"/>`,
  tool: `<path d="M8 21 L14 6" stroke="#8a6a44" stroke-width="2"/><path d="M6 6 c4 -3 10 -3 14 1" stroke="#8a8e94" stroke-width="2.4" fill="none" stroke-linecap="round"/>`,
  torch: `<path d="M12 22 L12 10" stroke="#6a4a2a" stroke-width="2.4"/><path d="M12 2 c3 3 4 5 2 8 c-1 1 -3 1 -4 0 c-2 -3 -1 -5 2 -8 z" fill="#ff9a2a"/><path d="M12 5 c1.5 2 1.5 3 .5 4.5 c-1 .5 -2 0 -1.5 -1.5 z" fill="#ffe08a"/>`,
  trident: `<path d="M12 22 L12 7" stroke="#8a6a44" stroke-width="1.8"/><path d="M7 3 L7 8 L17 8 L17 3 M12 2 L12 8" stroke="#cfd6dc" stroke-width="1.5" fill="none"/>`,
  throw: `<path d="M6 20 c-2 -4 2 -8 6 -6" stroke="#8a6a44" stroke-width="1.4" fill="none"/><circle cx="15" cy="9" r="3" fill="#8a8278" stroke="#4a4238"/>`,
  shield: `<path d="M5 4 h14 v9 c0 5 -4 8 -7 9 c-3 -1 -7 -4 -7 -9 z" fill="#9e2a22" stroke="#4a1a14"/><circle cx="12" cy="12" r="2.4" fill="#d8b040"/><path d="M12 5 v4 M12 15 v5" stroke="#d8b040" stroke-width="1"/>`,
  head: `<path d="M5 15 c0 -7 3 -11 7 -11 c4 0 7 4 7 11 z" fill="#b8902a" stroke="#6a4a14"/><path d="M4 15 h16 v2 h-16 z" fill="#8a6a1a"/><path d="M12 4 c-1 -2 1 -3 2 -2" stroke="#9e2a22" stroke-width="2" fill="none"/>`,
  body: `<path d="M6 4 h12 l2 4 l-2 2 v11 h-12 v-11 l-2 -2 z" fill="#8a8e94" stroke="#4a4e54"/><path d="M7 11 h10 M7 14 h10 M7 17 h10" stroke="#5a5e64" stroke-width="1"/>`,
  legs: `<path d="M7 3 h4 v13 l2 4 h-6 z M13 3 h4 v13 l2 4 h-6 z" fill="#7a5a32" stroke="#4a3418"/>`,
};
export function gearIcon(slot, kind) {
  const k = slot === 'weapon' ? (GI[kind] ? kind : kind === 'fist' ? 'knife' : 'blade') : slot === 'offhand' ? 'shield' : slot;
  return GI[k] ? S(GI[k]) : '';
}
