import { ChangeDetectorRef, Component, inject, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { DriverRoute, RoutePlan, RouteStop } from '../../models/delivery.model';
import { DeliveryData } from '../../service/delivery-data';
import { formatDuration } from '../../utils/format-duration';

@Component({
  selector: 'app-rider-work',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './rider-work.html',
})
export class RiderWork implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly data = inject(DeliveryData);
  private readonly cdr = inject(ChangeDetectorRef);

  driver: DriverRoute | null = null;
  restaurant: RoutePlan['restaurant'] | null = null;
  loading = true;
  error = '';
  actionError = '';
  selectedStopId: number | null = null;
  updatingOrderId: number | null = null;
  undoingOrderId: number | null = null;
  readonly deliveredOrderIds = new Set<number>();
  undoableDeliveries: Array<{
    orderId: number;
    customerName: string;
    previousStatus: string | null;
    timer: ReturnType<typeof setTimeout>;
  }> = [];

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
        this.driver?.sequence.forEach((stop) => {
          if (stop.status === 'done') this.deliveredOrderIds.add(stop.order_id);
        });
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

  ngOnDestroy(): void {
    this.undoableDeliveries.forEach((delivery) => clearTimeout(delivery.timer));
  }

  get activeStop(): RouteStop | undefined {
    const sequence = this.driver?.sequence ?? [];
    if (sequence.length > 0 && sequence.every((stop) => this.deliveredOrderIds.has(stop.order_id))) {
      return undefined;
    }
    if (this.selectedStopId !== null) {
      return sequence.find((stop) => stop.order_id === this.selectedStopId);
    }
    return sequence.find((stop) => !this.deliveredOrderIds.has(stop.order_id));
  }

  get completedStops(): number {
    return this.driver?.sequence.filter((stop) => this.deliveredOrderIds.has(stop.order_id)).length ?? 0;
  }

  isDelivered(stop: RouteStop): boolean {
    return this.deliveredOrderIds.has(stop.order_id);
  }

  selectStop(stop: RouteStop): void {
    this.selectedStopId = stop.order_id;
    this.actionError = '';
  }

  markDelivered(): void {
    const stop = this.activeStop;
    if (!stop || this.isDelivered(stop) || this.updatingOrderId !== null) return;

    this.updatingOrderId = stop.order_id;
    this.actionError = '';
    this.data.updateOrderStatus(stop.order_id, 'done').subscribe({
      next: () => {
        this.updatingOrderId = null;
        this.deliveredOrderIds.add(stop.order_id);
        if (this.selectedStopId === stop.order_id) this.selectedStopId = null;
        const timer = setTimeout(() => {
          this.removeUndoableDelivery(stop.order_id);
          this.cdr.detectChanges();
        }, 5000);
        this.undoableDeliveries = [
          ...this.undoableDeliveries,
          {
            orderId: stop.order_id,
            customerName: stop.customer_name,
            previousStatus: stop.status ?? null,
            timer,
          },
        ];
        this.cdr.detectChanges();
      },
      error: () => {
        this.updatingOrderId = null;
        this.actionError = `บันทึกสถานะส่งของ ${stop.customer_name} ไม่สำเร็จ กรุณาลองอีกครั้ง`;
        this.cdr.detectChanges();
      },
    });
  }

  undoDelivery(orderId: number): void {
    const delivery = this.undoableDeliveries.find((item) => item.orderId === orderId);
    if (!delivery || this.undoingOrderId !== null) return;

    this.undoingOrderId = orderId;
    this.actionError = '';
    this.data.updateOrderStatus(orderId, delivery.previousStatus ?? 'pending').subscribe({
      next: () => {
        this.undoingOrderId = null;
        this.deliveredOrderIds.delete(orderId);
        if (this.selectedStopId === null || this.selectedStopId === orderId) {
          this.selectedStopId = orderId;
        }
        this.removeUndoableDelivery(orderId);
        this.cdr.detectChanges();
      },
      error: () => {
        this.undoingOrderId = null;
        this.actionError = 'ยกเลิกสถานะส่งไม่สำเร็จ กรุณาลองอีกครั้ง';
        this.cdr.detectChanges();
      },
    });
  }

  private removeUndoableDelivery(orderId: number): void {
    const delivery = this.undoableDeliveries.find((item) => item.orderId === orderId);
    if (delivery) clearTimeout(delivery.timer);
    this.undoableDeliveries = this.undoableDeliveries.filter((item) => item.orderId !== orderId);
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
