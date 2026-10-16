import { AfterViewInit, ChangeDetectorRef, Component, ElementRef, OnDestroy, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import * as L from 'leaflet';
import { DeliveryData } from '../../service/delivery-data';
import { DEPOT, Order } from '../../models/delivery.model';
import { createMap, esc, pinIcon } from '../../utils/map-utils';

@Component({
  selector: 'app-orders',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './orders.html'
})
export class Orders implements AfterViewInit, OnDestroy {
  @ViewChild('mapEl', { static: true }) mapEl!: ElementRef<HTMLDivElement>;

  orders: Order[] = [];
  found = '';
  error = '';
  picking = false;

  phone = '';
  name = '';
  pos = '';
  boxes = 1;
  editingOrderId: number | null = null;
  editBoxes = 1;
  editError = '';

  private map!: L.Map;
  private pins = L.layerGroup();
  private temp?: L.Marker;

  constructor(private data: DeliveryData, private cdr: ChangeDetectorRef) {}

  get totalBoxes(): number {
    return this.orders.reduce((sum, o) => sum + o.boxes, 0);
  }

  ngAfterViewInit(): void {
    this.map = createMap(this.mapEl.nativeElement);
    this.pins.addTo(this.map);
    L.marker(DEPOT, { icon: pinIcon('ร้าน', '#0f172a') }).addTo(this.map);

    this.map.on('click', (e: L.LeafletMouseEvent) => {
      if (!this.picking) return;
      this.picking = false;
      this.error = '';
      this.pos = `${e.latlng.lat.toFixed(6)}, ${e.latlng.lng.toFixed(6)}`;
      this.temp?.remove();
      this.temp = L.marker(e.latlng).addTo(this.map);
      this.cdr.detectChanges();
    });
    this.loadOrders();
  }

  ngOnDestroy(): void { this.map?.remove(); }

  loadOrders(): void {
    this.data.getOrders().subscribe({
      next: (orders) => {
        this.orders = orders;
        this.pins.clearLayers();
        orders.forEach(o =>
          L.marker([o.lat, o.lng], { icon: pinIcon(String(o.boxes), '#ea580c') })
            .bindPopup(`${esc(o.name)} · ${o.boxes} กล่อง`).addTo(this.pins));
        this.cdr.detectChanges();
      },
      error: () => { this.error = 'โหลดออเดอร์ไม่สำเร็จ ตรวจว่า backend เปิดอยู่'; this.cdr.detectChanges(); }
    });
  }

  findCustomer(): void {
    const phone = this.phone.trim();
    if (!phone) return;
    this.data.findCustomer(phone).subscribe({
      next: (c) => {
        if (c) {
          this.name = c.name;
          this.pos = `${c.lat}, ${c.lng}`;
          this.found = 'พบลูกค้าเก่า: ' + c.name;
        } else {
          this.found = 'ไม่พบเบอร์นี้ กรอกข้อมูลลูกค้าใหม่ได้เลย';
        }
        this.cdr.detectChanges();
      },
      error: () => { this.found = 'ไม่พบเบอร์นี้ กรอกข้อมูลลูกค้าใหม่ได้เลย'; this.cdr.detectChanges(); }
    });
  }

  pickOnMap(): void {
    this.picking = true;
    this.error = 'คลิกบนแผนที่เพื่อปักพิกัดบ้านลูกค้า';
  }

  editOrder(order: Order): void {
    if (order.id === undefined) {
      this.editError = 'ไม่พบรหัสออเดอร์';
      return;
    }

    this.editingOrderId = order.id;
    this.editBoxes = order.boxes;
    this.editError = '';
  }

  cancelEdit(): void {
    this.editingOrderId = null;
    this.editError = '';
  }

  saveEdit(): void {
    if (this.editingOrderId === null) return;
    if (!Number.isSafeInteger(this.editBoxes) || this.editBoxes < 1) {
      this.editError = 'จำนวนกล่องต้องเป็นจำนวนเต็มบวก';
      return;
    }

    this.editError = '';
    this.data.updateOrder(this.editingOrderId, this.editBoxes).subscribe({
      next: () => {
        this.editingOrderId = null;
        this.loadOrders();
      },
      error: () => {
        this.editError = 'แก้ไขออเดอร์ไม่สำเร็จ';
        this.cdr.detectChanges();
      }
    });
  }

  save(): void {
    const [lat, lng] = this.pos.split(',').map(s => parseFloat(s));
    if (!this.name.trim()) { this.error = 'กรอกชื่อลูกค้า'; return; }
    if (isNaN(lat) || isNaN(lng)) { this.error = 'พิกัดไม่ถูกต้อง ใช้รูปแบบ 13.7563, 100.5018 หรือกดปักบนแผนที่'; return; }
    if (!Number.isSafeInteger(this.boxes) || this.boxes < 1) { this.error = 'จำนวนกล่องต้องเป็นจำนวนเต็มบวก'; return; }
    this.error = '';

    this.data.addOrder({ name: this.name.trim(), phone: this.phone.trim(), lat, lng, boxes: this.boxes }).subscribe({
      next: () => {
        this.phone = this.name = this.pos = '';
        this.boxes = 1;
        this.found = '';
        this.temp?.remove();
        this.loadOrders();
      },
      error: () => { this.error = 'บันทึกไม่สำเร็จ'; this.cdr.detectChanges(); }
    });
  }
}