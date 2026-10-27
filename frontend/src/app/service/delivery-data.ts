import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map, of, switchMap, throwError } from 'rxjs';
import { Customer, Order, RoutePlan } from '../models/delivery.model';
import { environment } from '../../environments/environment';

interface OrderRow {
  order_id: number;
  quantity: number;
  status: string | null;
  customer_id: number;
  customer_name: string;
  customer_phone: string;
  lat: number;
  lng: number;
}

interface CreateCustomerResponse {
  customer_id: number;
}

interface NewOrder {
  name: string;
  phone: string;
  lat: number;
  lng: number;
  boxes: number;
}

@Injectable({ providedIn: 'root' })
export class DeliveryData {
  private readonly http = inject(HttpClient);

  getCustomers(): Observable<Customer[]> {
    return this.http.get<Customer[]>(`${environment.apiUrl}/customer`).pipe(
      map((customers) =>
        customers.map((customer) => ({
          ...customer,
          lat: Number(customer.lat),
          lng: Number(customer.lng),
        })),
      ),
    );
  }

  getOrders(): Observable<Order[]> {
    return this.http.get<OrderRow[]>(`${environment.apiUrl}/order`).pipe(
      map((rows) =>
        rows.map((row) => ({
          id: row.order_id,
          name: row.customer_name,
          phone: row.customer_phone,
          lat: Number(row.lat),
          lng: Number(row.lng),
          boxes: Number(row.quantity),
          status: row.status,
        })),
      ),
    );
  }

  getRoutePlan(drivers: number): Observable<RoutePlan> {
    return this.http.get<RoutePlan>(`${environment.apiUrl}/route`, {
      params: { drivers },
    });
  }

  findCustomer(phone: string): Observable<Customer | undefined> {
    return this.getCustomers().pipe(
      map((customers) => customers.find((customer) => customer.phone === phone)),
    );
  }

  addCustomer(customer: Customer): Observable<CreateCustomerResponse> {
    return this.http.post<CreateCustomerResponse>(`${environment.apiUrl}/customer`, customer);
  }

  updateCustomer(id: number, customer: Customer): Observable<unknown> {
    return this.http.put(`${environment.apiUrl}/customer/${id}`, customer);
  }

  updateOrder(id: number, quantity: number): Observable<unknown> {
    return this.http.put(`${environment.apiUrl}/order/${id}`, { quantity });
  }

  updateOrderStatus(id: number, status: string): Observable<unknown> {
    return this.http.put(`${environment.apiUrl}/order/${id}`, { status });
  }

  addOrder(order: NewOrder): Observable<void> {
    return this.findCustomer(order.phone).pipe(
      switchMap((customer) => {
        if (customer) {
          const customerId = customer.id;
          if (customerId === undefined) {
            return throwError(() => new Error('Customer record has no id'));
          }

          if (customer.lat === order.lat && customer.lng === order.lng) {
            return of(customerId);
          }

          return this.updateCustomer(customerId, {
            name: customer.name,
            phone: customer.phone,
            lat: order.lat,
            lng: order.lng,
          }).pipe(map(() => customerId));
        }
        return this.addCustomer({
          name: order.name,
          phone: order.phone,
          lat: order.lat,
          lng: order.lng,
        }).pipe(map((result) => result.customer_id));
      }),
      switchMap((customerId) =>
        this.http.post(`${environment.apiUrl}/order`, {
          customer_id: customerId,
          quantity: order.boxes,
        }),
      ),
      map(() => undefined),
    );
  }
}
