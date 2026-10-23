import { AfterViewInit, ChangeDetectorRef, Component, ElementRef, OnDestroy, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import * as L from 'leaflet';
import { DriverRoute, RoutePlan } from '../../models/delivery.model';
import { DeliveryData } from '../../service/delivery-data';
import { createMap, esc, pinIcon } from '../../utils/map-utils';

@Component({
  imports: [CommonModule, FormsModule, RouterLink],
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
  private readonly routeColors = ['#dc2626', '#16a34a', '#2563eb', '#ea580c', '#9333ea'];

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
    const points: L.LatLngTuple[] = [];

    if (this.plan) {
      const depot: L.LatLngTuple = [this.plan.restaurant.lat, this.plan.restaurant.lng];
      points.push(depot);
      L.marker(depot, { icon: pinIcon('ร้าน', '#0f172a') })
        .bindPopup(esc(this.plan.restaurant.name))
        .addTo(this.routeLayers);

      const stopsByPosition = new Map<
        string,
        Array<{ driverId: number; color: string; stop: DriverRoute['sequence'][number]; sequenceNumber: number }>
      >();

      for (const driver of this.plan.drivers) {
        const routePoints: L.LatLngTuple[] = [depot];
        const color = this.colorFor(driver.driver_id);

        driver.sequence.forEach((stop, index) => {
          const position: L.LatLngTuple = [stop.lat, stop.lng];
          routePoints.push(position);
          points.push(position);
          const key = `${stop.lat},${stop.lng}`;
          const groupedStops = stopsByPosition.get(key) ?? [];
          groupedStops.push({ driverId: driver.driver_id, color, stop, sequenceNumber: index + 1 });
          stopsByPosition.set(key, groupedStops);
        });

        if (driver.sequence.length > 0) {
          routePoints.push(depot);
          const isSelected = driver.driver_id === this.selectedDriverId;
          L.polyline(routePoints, {
            color,
            weight: isSelected ? 5 : 4,
            opacity: this.selectedDriverId === null || isSelected ? 0.85 : 0.55,
          }).addTo(this.routeLayers);
        }
      }

      for (const groupedStops of stopsByPosition.values()) {
        const { lat, lng } = groupedStops[0]!.stop;
        const label =
          groupedStops.length === 1
            ? `${groupedStops[0]!.driverId}.${groupedStops[0]!.sequenceNumber}`
            : `${groupedStops.length} จุด`;
        const popup = groupedStops
          .map(
            ({ driverId, stop, sequenceNumber }) =>
              `ไรเดอร์ ${driverId} · จุด ${sequenceNumber}: ${esc(stop.customer_name)} · ${stop.quantity} กล่อง<br>${esc(stop.customer_phone)}`,
          )
          .join('<hr>');

        L.marker([lat, lng], { icon: pinIcon(label, groupedStops[0]!.color) })
          .bindPopup(popup)
          .addTo(this.routeLayers);
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

  colorForDriver(driverId: number): string {
    return this.colorFor(driverId);
  }
}
