// src/api/v1/tickets.js
import express from "express";
import TicketTypeRequest from "../../pairtest/lib/TicketTypeRequest.js";
import TicketService from "../../pairtest/TicketService.js";
import * as serviceObj from "../../utils/get-objects.js";
import {
  createBooking,
  getBookingById,
  getBookingsByAccount,
  updateBooking,
  deleteBooking
} from "../../utils/bookingStore.js";

const router = express.Router();

// POST /tickets  (your existing implementation, but store created booking)
router.post("/tickets", function (req, res) {
  const seatReservationService = serviceObj.seatReservationService;
  const ticketPaymentService = serviceObj.ticketPaymentService;
  const ticketHelper = serviceObj.ticketHelper;
  const ticketRequests = [];

  try {
    for (let ticketreq of req.body.ticketRequests) {
      let newTicketRequest = new TicketTypeRequest(ticketreq.ticketType, parseInt(ticketreq.noOfTickets));
      ticketRequests.push(newTicketRequest);
    }

    const ticketService = new TicketService(seatReservationService, ticketPaymentService, ticketHelper);

    // validate
    ticketService.validatePurchaseRequest(parseInt(req.body.accountid), ticketRequests);

    // compute totals
    const totalAmount = ticketService.calculateTotalPriceInPurchase(ticketRequests);
    const totalSeats = ticketService.doTotalSeatsInPurchase(ticketRequests);

    // perform payment and seat reservation (same behavior as your service)
    ticketService.makePayment(parseInt(req.body.accountid), totalAmount);
    ticketService.reserveSeats(parseInt(req.body.accountid), totalSeats);

    // store booking record (in-memory) and return it
    const booking = createBooking({
      accountId: parseInt(req.body.accountid),
      ticketRequests,
      totalAmount,
      totalSeats,
      meta: { note: "Created via /tickets" }
    });

    res.status(201).send({ success: true, booking });
  } catch (err) {
    res.status(400).send({ success: false, error: err.message });
  }
});

/*
  GET endpoints:
  - GET /tickets/account/:accountId    -> list bookings for account
  - GET /tickets/:bookingId            -> get one booking
*/
router.get("/tickets/account/:accountId", (req, res) => {
  try {
    const accountId = req.params.accountId;
    const bookings = getBookingsByAccount(accountId);
    res.send({ success: true, bookings });
  } catch (err) {
    res.status(500).send({ success: false, error: err.message });
  }
});

router.get("/tickets/:bookingId", (req, res) => {
  try {
    const booking = getBookingById(req.params.bookingId);
    if (!booking) return res.status(404).send({ success: false, error: "Booking not found" });
    res.send({ success: true, booking });
  } catch (err) {
    res.status(500).send({ success: false, error: err.message });
  }
});

/*
  PUT /tickets/:bookingId
  - Allow updating ticketRequests for a booking (simple example)
  - Re-validates the new request with TicketService
  - NOTES: this implementation updates the stored booking and recalculates totals,
           but DOES NOT auto-run payments/refunds or seat reallocation. See TODOs.
*/
router.put("/tickets/:bookingId", (req, res) => {
  try {
    const bookingId = req.params.bookingId;
    const existing = getBookingById(bookingId);
    if (!existing) return res.status(404).send({ success: false, error: "Booking not found" });
    if (existing.status === "CANCELLED") return res.status(400).send({ success: false, error: "Cannot update a cancelled booking" });

    const ticketHelper = serviceObj.ticketHelper;
    const seatReservationService = serviceObj.seatReservationService;
    const ticketPaymentService = serviceObj.ticketPaymentService;

    // build new TicketTypeRequest array from payload
    const ticketRequests = [];
    for (let ticketreq of req.body.ticketRequests) {
      let newTicketRequest = new TicketTypeRequest(ticketreq.ticketType, parseInt(ticketreq.noOfTickets));
      ticketRequests.push(newTicketRequest);
    }

    const ticketService = new TicketService(seatReservationService, ticketPaymentService, ticketHelper);

    // validate new payload
    ticketService.validatePurchaseRequest(parseInt(existing.accountId), ticketRequests);

    // recalculate totals
    const totalAmount = ticketService.calculateTotalPriceInPurchase(ticketRequests);
    const totalSeats = ticketService.doTotalSeatsInPurchase(ticketRequests);

    // TODO: Production: handle payment difference (charge or refund) via paymentService
    // TODO: Production: adjust reserved seats via seatReservationService (release/add)
    // For now we only update the stored record and return the new totals.

    const updated = updateBooking(bookingId, {
      ticketRequests,
      totalAmount,
      totalSeats,
      meta: { ...existing.meta, updatedBy: "PUT /tickets/:bookingId" }
    });

    res.send({ success: true, booking: updated, note: "Updated in store. Implement payment/seat changes in production." });
  } catch (err) {
    res.status(400).send({ success: false, error: err.message });
  }
});

/*
  DELETE /tickets/:bookingId
  - Soft-cancels a booking (status -> CANCELLED)
  - TODO: Production: call paymentService to refund, and seatReservationService to release seats.
*/
router.delete("/tickets/:bookingId", (req, res) => {
  try {
    const bookingId = req.params.bookingId;
    const existing = getBookingById(bookingId);
    if (!existing) return res.status(404).send({ success: false, error: "Booking not found" });
    if (existing.status === "CANCELLED") return res.status(400).send({ success: false, error: "Booking already cancelled" });

    // TODO: Production: refund via ticketPaymentService and release seats via seatReservationService.
    // Example:
    // ticketPaymentService.refund(existing.accountId, existing.totalAmount);
    // seatReservationService.releaseSeat(existing.accountId, existing.totalSeats);

    const ok = deleteBooking(bookingId);
    if (!ok) return res.status(500).send({ success: false, error: "Failed to cancel booking" });

    res.send({ success: true, message: "Booking cancelled (soft). Implement refunds/seatrelease in production." });
  } catch (err) {
    res.status(500).send({ success: false, error: err.message });
  }
});

export default router;
