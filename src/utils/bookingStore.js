// src/utils/bookingStore.js
// Simple in-memory booking store. Replace with DB for production.

import { randomUUID } from 'crypto';

const bookings = new Map(); // bookingId => bookingObject

export function createBooking({ accountId, ticketRequests, totalAmount, totalSeats, meta = {} }) {
  const id = randomUUID();
  const booking = {
    id,
    accountId,
    ticketRequests,
    totalAmount,
    totalSeats,
    status: "CONFIRMED", // or "CANCELLED", "PENDING"
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    meta
  };
  bookings.set(id, booking);
  return booking;
}

export function getBookingById(id) {
  return bookings.get(id) ?? null;
}

export function getBookingsByAccount(accountId) {
  return Array.from(bookings.values()).filter(b => String(b.accountId) === String(accountId));
}

export function updateBooking(id, patch) {
  const existing = bookings.get(id);
  if (!existing) return null;
  const updated = {
    ...existing,
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  bookings.set(id, updated);
  return updated;
}

export function deleteBooking(id) {
  const existing = bookings.get(id);
  if (!existing) return false;
  // mark cancelled instead of deleting permanently (safer)
  existing.status = "CANCELLED";
  existing.updatedAt = new Date().toISOString();
  bookings.set(id, existing);
  return true;
}
