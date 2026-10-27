import { AfterViewInit, ChangeDetectorRef, Component, ElementRef, OnDestroy, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import * as L from 'leaflet';
import { DriverRoute, ROUTE_STYLES, RoutePlan } from '../../models/delivery.model';
import { DeliveryData } from '../../service/delivery-data';
import { createMap, esc, pinIcon } from '../../utils/map-utils';
import { formatDuration } from '../../utils/format-duration';

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

  constructor(private data: DeliveryData, private cdr: ChangeDetectorRef) {}

  get selectedDriver(): DriverRoute | undefined {
    return this.plan?.drivers.find((driver) => driver.driver_id === this.selectedDriverId);
  }

  get visibleDrivers(): DriverRoute[] {
    return this.selectedDriver ? [this.selectedDriver] : this.plan?.drivers ?? [];
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
        this.selectedDriverId = null;
        this.loading = false;
        this.updateMap();
        this.cdr.detectChanges();
      },
      error: (error: unknown) => {
        this.loading = false;
        const serverError = error instanceof HttpErrorResponse ? error.error : null;
        this.error =
          typeof serverError?.error === 'string'
            ? serverError.error
            : 'โหลดแผนเส้นทางไม่สำเร็จ ตรวจว่า backend และ OSRM ใช้งานได้';
        this.cdr.detectChanges();
      },
    });
  }

  selectDriver(driverId: number): void {
    this.selectedDriverId = driverId;
    this.updateMap();
  }

  showAllDrivers(): void {
    this.selectedDriverId = null;
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

      for (const driver of this.visibleDrivers) {
        const routePoints: L.LatLngTuple[] = [depot];
        const routeStyle = this.routeStyleForDriver(driver.driver_id);

        driver.sequence.forEach((stop, index) => {
          const position: L.LatLngTuple = [stop.lat, stop.lng];
          routePoints.push(position);
          points.push(position);
          const key = `${stop.lat},${stop.lng}`;
          const groupedStops = stopsByPosition.get(key) ?? [];
          groupedStops.push({ driverId: driver.driver_id, color: routeStyle.color, stop, sequenceNumber: index + 1 });
          stopsByPosition.set(key, groupedStops);
        });

        if (driver.sequence.length > 0) {
          routePoints.push(depot);
          L.polyline(routePoints, {
            color: routeStyle.color,
            dashArray: routeStyle.dashArray,
            weight: 5,
            opacity: 0.85,
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
    return this.routeStyleForDriver(driverId).color;
  }

  routeStyleForDriver(driverId: number): (typeof ROUTE_STYLES)[number] {
    return ROUTE_STYLES[(driverId - 1) % ROUTE_STYLES.length]!;
  }

  colorForDriver(driverId: number): string {
    return this.colorFor(driverId);
  }

  formatDuration(minutes: number): string {
    return formatDuration(minutes);
  }
}
