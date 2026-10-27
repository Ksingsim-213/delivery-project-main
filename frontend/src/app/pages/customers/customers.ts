import { AfterViewInit, ChangeDetectorRef, Component, ElementRef, OnDestroy, ViewChild } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import * as L from 'leaflet';
import { DeliveryData } from '../../service/delivery-data';
import { Customer } from '../../models/delivery.model';
import { formatCoordinates, parseCoordinates } from '../../utils/coordinates';
import { createMap, esc, pinIcon } from '../../utils/map-utils';

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
  deleteError = '';
  deleteSuccess = '';
  picking = false;
  editId: number | null = null;
  confirmDeleteCustomerId: number | null = null;
  deletingCustomerId: number | null = null;

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
      this.pos = formatCoordinates(e.latlng);
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
        this.renderCustomerPins();
        this.cdr.detectChanges();
      },
      error: () => { this.error = 'โหลดรายชื่อลูกค้าไม่สำเร็จ ตรวจว่า backend เปิดอยู่'; this.cdr.detectChanges(); }
    });
  }

  pickOnMap(): void {
    this.picking = true;
    this.error = 'คลิกบนแผนที่เพื่อปักพิกัดบ้าน';
  }

  coordinatesChanged(value: string): void {
    const coordinates = parseCoordinates(value);
    if (!coordinates) return;

    if (this.temp) {
      this.temp.setLatLng(coordinates);
    } else {
      this.setTemp(L.latLng(coordinates.lat, coordinates.lng));
    }
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
    const coordinates = parseCoordinates(this.pos);
    const phone = this.phone.trim();
    if (!this.name.trim()) { this.error = 'กรอกชื่อลูกค้า'; return; }
    if (!/^\d{9,10}$/.test(phone)) { this.error = 'เบอร์โทรต้องเป็นตัวเลข 9–10 หลัก'; return; }
    if (!coordinates) { this.error = 'พิกัดไม่ถูกต้อง ใช้รูปแบบละติจูด, ลองจิจูด เช่น 13.7563, 100.5018'; return; }

    const body: Customer = { name: this.name.trim(), phone, ...coordinates };
    const req = this.editId == null ? this.data.addCustomer(body) : this.data.updateCustomer(this.editId, body);
    req.subscribe({
      next: () => { this.reset(); this.loadCustomers(); },
      error: () => { this.error = 'บันทึกไม่สำเร็จ (เบอร์นี้อาจมีอยู่แล้ว)'; this.cdr.detectChanges(); }
    });
  }

  confirmDelete(c: Customer): void {
    if (c.id === undefined) return;
    this.confirmDeleteCustomerId = c.id;
    this.deleteError = '';
    this.deleteSuccess = '';
  }

  cancelDelete(): void {
    this.confirmDeleteCustomerId = null;
    this.deleteError = '';
  }

  deleteCustomer(c: Customer): void {
    if (c.id === undefined || this.deletingCustomerId !== null) return;

    this.deletingCustomerId = c.id;
    this.deleteError = '';
    this.data.deleteCustomer(c.id).subscribe({
      next: () => {
        this.customers = this.customers.filter((customer) => customer.id !== c.id);
        this.renderCustomerPins();
        if (this.editId === c.id) this.reset();
        this.confirmDeleteCustomerId = null;
        this.deletingCustomerId = null;
        this.deleteSuccess = `ลบลูกค้า ${c.name} แล้ว`;
        this.cdr.detectChanges();
      },
      error: (error: unknown) => {
        this.deletingCustomerId = null;
        this.deleteError =
          error instanceof HttpErrorResponse && typeof error.error?.error === 'string'
            ? error.error.error
            : 'ลบลูกค้าไม่สำเร็จ กรุณาลองอีกครั้ง';
        this.cdr.detectChanges();
      }
    });
  }

  private renderCustomerPins(): void {
    this.pins.clearLayers();
    this.customers.forEach((c) =>
      L.circleMarker([c.lat, c.lng], { radius: 7, color: '#fff', weight: 2, fillColor: '#ea580c', fillOpacity: 1 })
        .bindPopup(`${esc(c.name)}<br>${esc(c.phone)}`).addTo(this.pins));
  }

  private setTemp(ll: L.LatLng): void {
    this.temp?.remove();
    this.temp = L.marker(ll, {
      icon: pinIcon('ย้าย', '#A43E32'),
      draggable: true,
      title: 'ลากหมุดเพื่อย้ายตำแหน่งบ้าน',
    })
      .on('dragend', () => {
        if (!this.temp) return;
        this.pos = formatCoordinates(this.temp.getLatLng());
        this.cdr.detectChanges();
      })
      .addTo(this.map);
  }
}