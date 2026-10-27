import * as L from 'leaflet';
import { DEPOT } from '../models/delivery.model';

export const createMap = (element: HTMLElement): L.Map => {
  const map = L.map(element, { minZoom: 11, zoomSnap: 0.5 }).setView(DEPOT, 14);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors',
    maxZoom: 19,
  }).addTo(map);
  return map;
};

export const esc = (value: string): string =>
  value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    };
    return entities[character] ?? character;
  });

export const pinIcon = (label: string, color: string): L.DivIcon =>
  L.divIcon({
    className: '',
    html: `<span style="display:grid;place-items:center;width:34px;height:34px;border:2px solid #fff;border-radius:50%;background:${color};color:#fff;font-size:11px;font-weight:700;box-shadow:0 1px 5px #0006">${esc(label)}</span>`,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
  });
