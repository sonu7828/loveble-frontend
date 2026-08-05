/**
 * Billing & Payments Service for Express REST API Backend.
 * Connects directly to Node.js / Express live /billing endpoints.
 * ZERO mock data or localStorage fallbacks.
 */
import { ApiClient } from "./client";

export interface InvoiceItemInput {
  serviceId?: string;
  productId?: string;
  description: string;
  unitPriceCents: number;
  quantity: number;
}

export interface CreateInvoiceInput {
  patientId: string;
  appointmentId?: string;
  discountCents: number;
  taxCents: number;
  dueDate?: string;
  items: InvoiceItemInput[];
}

export interface RecordPaymentInput {
  invoiceId?: string;
  patientId: string;
  appointmentId?: string;
  amountCents: number;
  tipCents: number;
  discountCents: number;
  paymentMethod: "card" | "cash" | "stripe" | "check" | "gift_card" | "other";
  stripePaymentId?: string;
}

export interface CreateRefundInput {
  paymentId: string;
  amountCents: number;
  reason: string;
  stripeRefundId?: string;
}

export interface Invoice {
  id: string;
  patientId: string;
  appointmentId?: string | null;
  subtotalCents: number;
  discountCents: number;
  taxCents: number;
  totalCents: number;
  status: "unpaid" | "partial" | "paid" | "cancelled" | "refunded";
  dueDate?: string | null;
  createdAt: string;
  updatedAt: string;
  patient?: { id: string; firstName: string; lastName: string; email?: string };
  invoiceItems?: Array<{
    id: string;
    serviceId?: string | null;
    productId?: string | null;
    description: string;
    unitPriceCents: number;
    quantity: number;
    totalCents: number;
    service?: { id: string; name: string };
    product?: { id: string; name: string };
  }>;
  payments?: Array<{
    id: string;
    amountCents: number;
    tipCents: number;
    discountCents: number;
    paymentMethod: string;
    status: string;
    createdAt: string;
    refunds?: Array<{ id: string; amountCents: number; reason: string }>;
    processor?: { id: string; fullName: string };
  }>;
}

export const billingService = {
  /**
   * Create a new invoice (Admin & Front Desk).
   */
  async createInvoice(input: CreateInvoiceInput): Promise<Invoice> {
    const res = await ApiClient.post<Invoice>("/billing/invoices", input);
    if (res.error) throw new Error(res.error);
    if (!res.data) throw new Error("No data returned from createInvoice");
    return res.data;
  },

  /**
   * Get all invoices (Admin / Staff).
   */
  async getInvoices(page = 1, perPage = 25): Promise<{ invoices: Invoice[]; meta?: any }> {
    const res = await ApiClient.get<{ data: Invoice[]; meta: any }>(`/billing/invoices?page=${page}&perPage=${perPage}`);
    if (res.error) throw new Error(res.error);
    const invoices = Array.isArray(res.data) ? res.data : (res.data?.data || []);
    return { invoices, meta: res.data?.meta };
  },

  /**
   * Get invoice by ID.
   */
  async getInvoiceById(id: string): Promise<Invoice> {
    const res = await ApiClient.get<Invoice>(`/billing/invoices/${id}`);
    if (res.error) throw new Error(res.error);
    const invoice = (res.data as any)?.data || res.data;
    if (!invoice) throw new Error("Invoice not found");
    return invoice;
  },

  /**
   * Get invoices for a specific patient.
   */
  async getPatientInvoices(patientId: string): Promise<Invoice[]> {
    const res = await ApiClient.get<Invoice[]>(`/billing/invoices/patient/${patientId}`);
    if (res.error) throw new Error(res.error);
    return Array.isArray(res.data) ? res.data : ((res.data as any)?.data || []);
  },

  /**
   * Cancel an unpaid invoice (Admin & Front Desk).
   */
  async cancelInvoice(id: string): Promise<Invoice> {
    const res = await ApiClient.post<Invoice>(`/billing/invoices/${id}/cancel`);
    if (res.error) throw new Error(res.error);
    return (res.data as any)?.data || res.data;
  },

  /**
   * Record a payment (Admin & Front Desk).
   */
  async recordPayment(input: RecordPaymentInput): Promise<any> {
    const res = await ApiClient.post("/billing/payments", input);
    if (res.error) throw new Error(res.error);
    return (res.data as any)?.data || res.data;
  },

  /**
   * Process a refund (Admin only).
   */
  async createRefund(input: CreateRefundInput): Promise<any> {
    const res = await ApiClient.post("/billing/refunds", input);
    if (res.error) throw new Error(res.error);
    return (res.data as any)?.data || res.data;
  },

  /**
   * Issue patient credit (Admin only).
   */
  async createCredit(input: { patientId: string; amountCents: number; reason: string; expiresAt?: string }): Promise<any> {
    const res = await ApiClient.post("/billing/credits", input);
    if (res.error) throw new Error(res.error);
    return (res.data as any)?.data || res.data;
  },

  /**
   * Get active unused credits for a patient.
   */
  async getPatientCredits(patientId: string): Promise<any[]> {
    const res = await ApiClient.get<any[]>(`/billing/credits/patient/${patientId}`);
    if (res.error) throw new Error(res.error);
    return Array.isArray(res.data) ? res.data : ((res.data as any)?.data || []);
  },
};
