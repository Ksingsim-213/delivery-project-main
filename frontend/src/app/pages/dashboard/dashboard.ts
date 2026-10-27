import { AfterViewInit, ChangeDetectorRef, Component, ElementRef, OnDestroy, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { forkJoin } from 'rxjs';
import * as L from 'leaflet';
import { DeliveryData } from '../../service/delivery-data';
import { CAPACITY, DEPOT, Order } from '../../models/delivery.model';
import { createMap, esc, pinIcon } from '../../utils/map-utils';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './dashboard.html'
})
export class Dashboard implements AfterViewInit, OnDestroy {
  @ViewChild('mapEl', { static: true }) mapEl!: ElementRef<HTMLDivElement>;

  orders: Order[] = [];
  customerCount = 0;
  error = '';
  loading = false;

  private map!: L.Map;
  private pins = L.layerGroup();

  constructor(private data: DeliveryData, private cdr: ChangeDetectorRef) {}

  get activeOrders(): Order[] { return this.orders.filter((order) => order.status !== 'done'); }
  get deliveredOrders(): Order[] { return this.orders.filter((order) => order.status === 'done'); }
  get totalBoxes(): number { return this.activeOrders.reduce((sum, order) => sum + order.boxes, 0); }
  get allBoxes(): number { return this.orders.reduce((sum, order) => sum + order.boxes, 0); }
  get minRiders(): number { return Math.ceil(this.totalBoxes / CAPACITY); }
  get latest(): Order[] { return [...this.activeOrders].reverse().slice(0, 8); }
  get latestDelivered(): Order[] { return [...this.deliveredOrders].reverse().slice(0, 8); }
  readonly capacity = CAPACITY;

  ngAfterViewInit(): void {
    this.map = createMap(this.mapEl.nativeElement);
    this.pins.addTo(this.map);
    L.marker(DEPOT, { icon: pinIcon('ร้าน', '#0f172a') }).addTo(this.map);
    this.refresh();
  }

  ngOnDestroy(): void { this.map?.remove(); }

  refresh(): void {
    this.loading = true;
    this.error = '';
    forkJoin([this.data.getOrders(), this.data.getCustomers()]).subscribe({
      next: ([orders, customers]) => {
        this.orders = orders;
        this.customerCount = customers.length;
        this.loading = false;

        this.pins.clearLayers();
        const pts: L.LatLngTuple[] = [DEPOT];
        this.activeOrders.forEach(o => {
          pts.push([o.lat, o.lng]);
          L.marker([o.lat, o.lng], { icon: pinIcon(String(o.boxes), '#ea580c') })
            .bindPopup(`${esc(o.name)} · ${o.boxes} กล่อง`).addTo(this.pins);
        });
        if (pts.length > 1) this.map.fitBounds(pts, { padding: [30, 30] });
        this.cdr.detectChanges();
      },
      error: () => {
        this.loading = false;
        this.error = 'โหลดข้อมูลไม่สำเร็จ ตรวจว่า backend เปิดอยู่';
        this.cdr.detectChanges();
      }
    });
  }
}