import { ChangeDetectorRef, Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { DriverRoute, RoutePlan } from '../../models/delivery.model';
import { DeliveryData } from '../../service/delivery-data';
import { formatDuration } from '../../utils/format-duration';

@Component({
  selector: 'app-rider-work',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './rider-work.html',
})
export class RiderWork implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly data = inject(DeliveryData);
  private readonly cdr = inject(ChangeDetectorRef);

  driver: DriverRoute | null = null;
  restaurant: RoutePlan['restaurant'] | null = null;
  loading = true;
  error = '';

  ngOnInit(): void {
    const driverId = Number(this.route.snapshot.paramMap.get('driverId'));
    const requestedDrivers = Number(this.route.snapshot.queryParamMap.get('drivers') ?? 3);

    if (!Number.isSafeInteger(driverId) || driverId < 1) {
      this.error = 'หมายเลขไรเดอร์ไม่ถูกต้อง';
      this.loading = false;
      return;
    }

    if (!Number.isSafeInteger(requestedDrivers) || requestedDrivers < 1 || requestedDrivers > 10) {
      this.error = 'จำนวนไรเดอร์ไม่ถูกต้อง กรุณากลับไปจัดเส้นทางใหม่';
      this.loading = false;
      return;
    }

    this.data.getRoutePlan(requestedDrivers).subscribe({
      next: (plan) => {
        this.driver = plan.drivers.find((item) => item.driver_id === driverId) ?? null;
        this.restaurant = plan.restaurant;
        this.loading = false;
        if (!this.driver) this.error = 'ไม่พบใบงานของไรเดอร์คนนี้ กรุณากลับไปจัดเส้นทางใหม่';
        this.cdr.detectChanges();
      },
      error: (error: unknown) => {
        this.loading = false;
        const serverError = error instanceof HttpErrorResponse ? error.error : null;
        this.error =
          typeof serverError?.error === 'string'
            ? serverError.error
            : 'โหลดใบงานไม่สำเร็จ ตรวจว่า backend และ OSRM ใช้งานได้';
        this.cdr.detectChanges();
      },
    });
  }

  directionsUrl(from: { lat: number; lng: number }, to: { lat: number; lng: number }): string {
    const params = new URLSearchParams({
      api: '1',
      origin: `${from.lat},${from.lng}`,
      destination: `${to.lat},${to.lng}`,
      travelmode: 'driving',
    });
    return `https://www.google.com/maps/dir/?${params.toString()}`;
  }

  previousStop(index: number): { lat: number; lng: number } {
    if (index === 0) return this.restaurant!;
    const previous = this.driver!.sequence[index - 1]!;
    return { lat: previous.lat, lng: previous.lng };
  }

  formatDuration(minutes: number): string {
    return formatDuration(minutes);
  }
}
