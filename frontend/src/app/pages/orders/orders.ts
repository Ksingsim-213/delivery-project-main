import { AfterViewInit, ChangeDetectorRef, Component, ElementRef, OnDestroy, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import * as L from 'leaflet';
import { DeliveryData } from '../../service/delivery-data';
import { DEPOT, Order } from '../../models/delivery.model';
import { formatCoordinates, parseCoordinates } from '../../utils/coordinates';
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
  confirmDeleteOrderId: number | null = null;
  deletingOrderId: number | null = null;
  deleteError = '';
  deleteSuccess = '';

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
      this.pos = formatCoordinates(e.latlng);
      this.setTemp(e.latlng);
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
          this.setTemp(L.latLng(c.lat, c.lng));
          this.map.setView([c.lat, c.lng], 15);
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

  coordinatesChanged(value: string): void {
    const coordinates = parseCoordinates(value);
    if (!coordinates) return;

    if (this.temp) {
      this.temp.setLatLng(coordinates);
    } else {
      this.setTemp(L.latLng(coordinates.lat, coordinates.lng));
    }
  }

  private setTemp(ll: L.LatLng): void {
    this.temp?.remove();
    this.temp = L.marker(ll, {
      icon: pinIcon('ย้าย', '#A43E32'),
      draggable: true,
      title: 'ลากหมุดเพื่อย้ายจุดส่ง',
    })
      .on('dragend', () => {
        if (!this.temp) return;
        this.pos = formatCoordinates(this.temp.getLatLng());
        this.cdr.detectChanges();
      })
      .addTo(this.map);
  }

  editOrder(order: Order): void {
    if (order.id === undefined) {
      this.editError = 'ไม่พบรหัสออเดอร์';
      return;
    }

    this.confirmDeleteOrderId = null;
    this.editingOrderId = order.id;
    this.editBoxes = order.boxes;
    this.editError = '';
  }

  cancelEdit(): void {
    this.editingOrderId = null;
    this.editError = '';
  }

  confirmDelete(order: Order): void {
    if (order.id === undefined) {
      this.deleteError = 'ไม่พบรหัสออเดอร์ จึงไม่สามารถลบได้';
      return;
    }

    this.editingOrderId = null;
    this.confirmDeleteOrderId = order.id;
    this.deleteError = '';
    this.deleteSuccess = '';
  }

  cancelDelete(): void {
    this.confirmDeleteOrderId = null;
    this.deleteError = '';
  }

  deleteOrder(order: Order): void {
    if (order.id === undefined || this.confirmDeleteOrderId !== order.id || this.deletingOrderId !== null) {
      return;
    }

    this.deletingOrderId = order.id;
    this.deleteError = '';
    this.deleteSuccess = '';
    this.data.deleteOrder(order.id).subscribe({
      next: () => {
        this.deletingOrderId = null;
        this.confirmDeleteOrderId = null;
        this.deleteSuccess = `ลบออเดอร์ของ ${order.name} แล้ว`;
        this.loadOrders();
      },
      error: () => {
        this.deletingOrderId = null;
        this.deleteError = `ลบออเดอร์ของ ${order.name} ไม่สำเร็จ กรุณาลองอีกครั้ง`;
        this.cdr.detectChanges();
      },
    });
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
    const coordinates = parseCoordinates(this.pos);
    if (!this.name.trim()) { this.error = 'กรอกชื่อลูกค้า'; return; }
    if (!coordinates) { this.error = 'พิกัดไม่ถูกต้อง ใช้รูปแบบละติจูด, ลองจิจูด เช่น 13.7563, 100.5018'; return; }
    if (!Number.isSafeInteger(this.boxes) || this.boxes < 1) { this.error = 'จำนวนกล่องต้องเป็นจำนวนเต็มบวก'; return; }
    this.error = '';

    this.data.addOrder({
      name: this.name.trim(),
      phone: this.phone.trim(),
      ...coordinates,
      boxes: this.boxes,
    }).subscribe({
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