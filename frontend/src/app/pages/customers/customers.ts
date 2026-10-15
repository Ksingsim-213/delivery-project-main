import { AfterViewInit, ChangeDetectorRef, Component, ElementRef, OnDestroy, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import * as L from 'leaflet';
import { DeliveryData } from '../../service/delivery-data';
import { Customer } from '../../models/delivery.model';
import { createMap, esc } from '../../utils/map-utils';

@Component({
  selector: 'app-customers',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './customers.html'
})
export class Customers implements AfterViewInit, OnDestroy {
  @ViewChild('mapEl', { static: true }) mapEl!: ElementRef<HTMLDivElement>;

  customers: Customer[] = [];
  keyword = '';
  error = '';
  picking = false;
  editId: number | null = null;

  name = '';
  phone = '';
  pos = '';

  private map!: L.Map;
  private pins = L.layerGroup();
  private temp?: L.Marker;

  constructor(private data: DeliveryData, private cdr: ChangeDetectorRef) {}

  get shown(): Customer[] {
    const k = this.keyword.trim().toLowerCase();
    return k ? this.customers.filter(c => c.name.toLowerCase().includes(k) || c.phone.includes(k)) : this.customers;
  }

  ngAfterViewInit(): void {
    this.map = createMap(this.mapEl.nativeElement);
    this.pins.addTo(this.map);
    this.map.on('click', (e: L.LeafletMouseEvent) => {
      if (!this.picking) return;
      this.picking = false;
      this.error = '';
      this.pos = `${e.latlng.lat.toFixed(6)}, ${e.latlng.lng.toFixed(6)}`;
      this.setTemp(e.latlng);
      this.cdr.detectChanges();
    });
    this.loadCustomers();
  }

  ngOnDestroy(): void { this.map?.remove(); }

  loadCustomers(): void {
    this.data.getCustomers().subscribe({
      next: (list) => {
        this.customers = list;
        this.pins.clearLayers();
        list.forEach(c =>
          L.circleMarker([c.lat, c.lng], { radius: 7, color: '#fff', weight: 2, fillColor: '#ea580c', fillOpacity: 1 })
            .bindPopup(`${esc(c.name)}<br>${esc(c.phone)}`).addTo(this.pins));
        this.cdr.detectChanges();
      },
      error: () => { this.error = 'โหลดรายชื่อลูกค้าไม่สำเร็จ ตรวจว่า backend เปิดอยู่'; this.cdr.detectChanges(); }
    });
  }

  pickOnMap(): void {
    this.picking = true;
    this.error = 'คลิกบนแผนที่เพื่อปักพิกัดบ้าน';
  }

  edit(c: Customer): void {
    this.editId = c.id ?? null;
    this.name = c.name;
    this.phone = c.phone;
    this.pos = `${c.lat}, ${c.lng}`;
    this.setTemp(L.latLng(c.lat, c.lng));
    this.map.setView([c.lat, c.lng], 15);
    this.error = '';
  }

  reset(): void {
    this.editId = null;
    this.name = this.phone = this.pos = '';
    this.temp?.remove();
    this.temp = undefined;
    this.error = '';
  }

  save(): void {
    const [lat, lng] = this.pos.split(',').map(s => parseFloat(s));
    const phone = this.phone.trim();
    if (!this.name.trim()) { this.error = 'กรอกชื่อลูกค้า'; return; }
    if (!/^\d{9,10}$/.test(phone)) { this.error = 'เบอร์โทรต้องเป็นตัวเลข 9–10 หลัก'; return; }
    if (isNaN(lat) || isNaN(lng)) { this.error = 'พิกัดไม่ถูกต้อง ใช้รูปแบบ 13.7563, 100.5018 หรือกดปักบนแผนที่'; return; }

    const body: Customer = { name: this.name.trim(), phone, lat, lng };
    const req = this.editId == null ? this.data.addCustomer(body) : this.data.updateCustomer(this.editId, body);
    req.subscribe({
      next: () => { this.reset(); this.loadCustomers(); },
      error: () => { this.error = 'บันทึกไม่สำเร็จ (เบอร์นี้อาจมีอยู่แล้ว)'; this.cdr.detectChanges(); }
    });
  }

  private setTemp(ll: L.LatLng): void {
    this.temp?.remove();
    this.temp = L.marker(ll).addTo(this.map);
  }
}