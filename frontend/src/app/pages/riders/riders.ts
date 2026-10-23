import { AfterViewInit, ChangeDetectorRef, Component, ElementRef, OnDestroy, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import * as L from 'leaflet';
import { DriverRoute, RoutePlan } from '../../models/delivery.model';
import { DeliveryData } from '../../service/delivery-data';
import { createMap, esc, pinIcon } from '../../utils/map-utils';

@Component({
  imports: [CommonModule, FormsModule],
  selector: 'app-riders',
  styleUrl: './riders.css',
  templateUrl: './riders.html',
})
export class Riders implements AfterViewInit, OnDestroy {
  @ViewChild('mapEl', { static: true }) mapEl!: ElementRef<HTMLDivElement>;

  driverCount = 3;
  plan: RoutePlan | null = null;
  selectedDriverId: number | null = null;
  loading = false;
  error = '';

  private map!: L.Map;
  private routeLayers = L.layerGroup();
  private readonly routeColors = ['#4f46e5', '#059669', '#ea580c', '#db2777', '#0891b2'];

  constructor(private data: DeliveryData, private cdr: ChangeDetectorRef) {}

  get selectedDriver(): DriverRoute | undefined {
    return this.plan?.drivers.find((driver) => driver.driver_id === this.selectedDriverId);
  }

  ngAfterViewInit(): void {
    this.map = createMap(this.mapEl.nativeElement);
    this.routeLayers.addTo(this.map);
    this.loadRoutePlan();
  }

  ngOnDestroy(): void {
    this.map?.remove();
  }

  loadRoutePlan(): void {
    if (!Number.isSafeInteger(this.driverCount) || this.driverCount < 1 || this.driverCount > 10) {
      this.error = 'จำนวนไรเดอร์ต้องเป็นจำนวนเต็มตั้งแต่ 1 ถึง 10 คน';
      return;
    }

    this.loading = true;
    this.error = '';
    this.data.getRoutePlan(this.driverCount).subscribe({
      next: (plan) => {
        this.plan = plan;
        this.selectedDriverId = plan.drivers[0]?.driver_id ?? null;
        this.loading = false;
        this.updateMap();
        this.cdr.detectChanges();
      },
      error: () => {
        this.loading = false;
        this.error = 'โหลดแผนเส้นทางไม่สำเร็จ ตรวจว่า backend เปิดอยู่';
        this.cdr.detectChanges();
      },
    });
  }

  selectDriver(driverId: number): void {
    this.selectedDriverId = driverId;
    this.updateMap();
  }

  private updateMap(): void {
    if (!this.map) return;

    this.routeLayers.clearLayers();
    const driver = this.selectedDriver;
    const points: L.LatLngTuple[] = [];

    if (this.plan) {
      const depot: L.LatLngTuple = [this.plan.restaurant.lat, this.plan.restaurant.lng];
      points.push(depot);
      L.marker(depot, { icon: pinIcon('ร้าน', '#0f172a') })
        .bindPopup(esc(this.plan.restaurant.name))
        .addTo(this.routeLayers);

      if (driver) {
        const routePoints: L.LatLngTuple[] = [depot];
        const color = this.colorFor(driver.driver_id);
        driver.sequence.forEach((stop, index) => {
          const position: L.LatLngTuple = [stop.lat, stop.lng];
          routePoints.push(position);
          points.push(position);
          L.marker(position, { icon: pinIcon(String(index + 1), color) })
            .bindPopup(
              `${index + 1}. ${esc(stop.customer_name)} · ${stop.quantity} กล่อง<br>${esc(stop.customer_phone)}`,
            )
            .addTo(this.routeLayers);
        });

        if (driver.sequence.length > 0) {
          routePoints.push(depot);
          L.polyline(routePoints, { color, weight: 4, opacity: 0.8 }).addTo(this.routeLayers);
        }
      }
    }

    if (points.length > 1) {
      this.map.fitBounds(points, { padding: [32, 32] });
    } else if (points.length === 1) {
      this.map.setView(points[0], 12);
    }
  }

  private colorFor(driverId: number): string {
    return this.routeColors[(driverId - 1) % this.routeColors.length] ?? this.routeColors[0];
  }
}
