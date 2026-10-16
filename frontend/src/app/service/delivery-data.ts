import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map, of, switchMap, throwError } from 'rxjs';
import { Customer, Order } from '../models/delivery.model';
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
    return this.http.get<Customer[]>(`${environment.apiUrl}/customer`);
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

  addOrder(order: NewOrder): Observable<void> {
    return this.findCustomer(order.phone).pipe(
      switchMap((customer) => {
        if (customer) {
          return customer.id === undefined
            ? throwError(() => new Error('Customer record has no id'))
            : of(customer.id);
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
