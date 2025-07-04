// controllers/pdfController.js
const mongoose = require('mongoose');
const Booking = require('../models/Booking');
const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');
const moment = require('moment');
const AuditLog = require('../models/AuditLog');

// Helper function to generate PDF
const generatePDF = (doc, booking, type) => {
  // Add header
  doc.fontSize(20).text(`${type.toUpperCase()}`, 200, 50, { align: 'center' });
  doc.fontSize(12).text(`Booking #: ${booking.bookingNumber}`, 200, 80, { align: 'center' });
  doc.fontSize(10).text(`Generated on: ${moment().format('DD/MM/YYYY hh:mm A')}`, 200, 95, { align: 'center' });
  
  // Add line
  doc.moveTo(50, 120).lineTo(550, 120).stroke();
  
  // Add customer details
  doc.fontSize(12).text('Customer Details:', 50, 130);
  doc.fontSize(10).text(`Name: ${booking.customerDetails.salutation} ${booking.customerDetails.name}`, 50, 150);
  doc.text(`Address: ${booking.customerDetails.address}`, 50, 165);
  doc.text(`Mobile: ${booking.customerDetails.mobile1}`, 50, 180);
  
  // Add vehicle details
  doc.moveTo(50, 200).lineTo(550, 200).stroke();
  doc.fontSize(12).text('Vehicle Details:', 50, 210);
  doc.fontSize(10).text(`Model: ${booking.modelDetails.model_name}`, 50, 230);
  doc.text(`Color: ${booking.colorDetails.name}`, 50, 245);
  
  return doc;
};

// Generate Booking Receipt
exports.generateBookingReceipt = async (req, res) => {
  try {
    const bookingId = req.params.id;
    const booking = await Booking.findById(bookingId)
      .populate('modelDetails')
      .populate('colorDetails')
      .populate('branchDetails')
      .populate('createdByDetails');
    
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }
    
    // Check if booking is approved (only generate receipt for approved bookings)
    if (booking.status !== 'APPROVED' && booking.status !== 'COMPLETED') {
      return res.status(400).json({ 
        success: false, 
        message: 'Booking receipt can only be generated for approved bookings' 
      });
    }
    
    const doc = new PDFDocument({ margin: 50 });
    let filename = `BookingReceipt_${booking.bookingNumber}.pdf`;
    
    // Set response headers
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    
    // Pipe PDF to response
    doc.pipe(res);
    
    // Generate PDF content
    generatePDF(doc, booking, 'Booking Receipt');
    
    // Add price components
    doc.moveTo(50, 270).lineTo(550, 270).stroke();
    doc.fontSize(12).text('Price Breakdown:', 50, 280);
    
    let y = 300;
    booking.priceComponents.forEach(component => {
      doc.fontSize(10).text(`${component.headerDetails.header_key}:`, 50, y);
      doc.text(`₹${component.discountedValue.toFixed(2)}`, 450, y, { align: 'right' });
      y += 15;
    });
    
    // Add accessories if any
    if (booking.accessories.length > 0) {
      doc.moveTo(50, y).lineTo(550, y).stroke();
      doc.fontSize(12).text('Accessories:', 50, y + 10);
      y += 30;
      
      booking.accessories.forEach(accessory => {
        doc.fontSize(10).text(`${accessory.accessory?.name || 'Accessory'}:`, 50, y);
        doc.text(`₹${accessory.price.toFixed(2)}`, 450, y, { align: 'right' });
        y += 15;
      });
    }
    
    // Add totals
    doc.moveTo(50, y).lineTo(550, y).stroke();
    doc.fontSize(12).text('Total Amount:', 50, y + 10);
    doc.text(`₹${booking.totalAmount.toFixed(2)}`, 450, y + 10, { align: 'right' });
    
    if (booking.discounts.length > 0) {
      doc.fontSize(12).text('Total Discount:', 50, y + 30);
      doc.text(`₹${(booking.totalAmount - booking.discountedAmount).toFixed(2)}`, 450, y + 30, { align: 'right' });
      
      doc.fontSize(12).text('Final Amount:', 50, y + 50);
      doc.text(`₹${booking.discountedAmount.toFixed(2)}`, 450, y + 50, { align: 'right' });
    }
    
    // Add footer
    doc.moveTo(50, y + 80).lineTo(550, y + 80).stroke();
    doc.fontSize(10).text('Terms & Conditions:', 50, y + 90);
    doc.fontSize(8).text('1. This is a computer generated receipt and does not require signature.', 50, y + 110);
    doc.text('2. All prices are inclusive of taxes where applicable.', 50, y + 125);
    doc.text('3. Please bring this receipt for vehicle delivery.', 50, y + 140);
    
    // Add approval signature if discounts were applied
    if (booking.discounts.length > 0) {
      doc.fontSize(10).text('Approved By:', 400, y + 170);
      doc.text('________________________', 400, y + 190);
      doc.text(booking.approvedByDetails?.name || 'Manager', 400, y + 210);
    }
    
    // Finalize PDF
    doc.end();
    
    // Log the action
    await AuditLog.create({
      action: 'GENERATE_PDF',
      entity: 'Booking',
      entityId: booking._id,
      user: req.user.id,
      ip: req.ip,
      metadata: { documentType: 'Booking Receipt' },
      status: 'SUCCESS'
    });
    
  } catch (err) {
    console.error('Error generating booking receipt:', err);
    
    await AuditLog.create({
      action: 'GENERATE_PDF',
      entity: 'Booking',
      entityId: req.params.id,
      user: req.user?.id,
      ip: req.ip,
      status: 'FAILED',
      error: err.message
    });
    
    res.status(500).json({
      success: false,
      message: 'Error generating booking receipt',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

// Generate Helmet Invoice
exports.generateHelmetInvoice = async (req, res) => {
  try {
    const bookingId = req.params.id;
    const booking = await Booking.findById(bookingId)
      .populate('modelDetails')
      .populate('colorDetails')
      .populate('branchDetails');
    
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }
    
    const doc = new PDFDocument({ margin: 50 });
    let filename = `HelmetInvoice_${booking.bookingNumber}.pdf`;
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    
    doc.pipe(res);
    
    generatePDF(doc, booking, 'Helmet Invoice');
    
    // Add helmet details
    doc.moveTo(50, 270).lineTo(550, 270).stroke();
    doc.fontSize(12).text('Helmet Details:', 50, 280);
    
    let y = 300;
    doc.fontSize(10).text('Helmet (Standard)', 50, y);
    doc.text('₹500.00', 450, y, { align: 'right' });
    y += 30;
    
    // Add totals
    doc.moveTo(50, y).lineTo(550, y).stroke();
    doc.fontSize(12).text('Total Amount:', 50, y + 10);
    doc.text('₹500.00', 450, y + 10, { align: 'right' });
    
    // Add footer
    doc.moveTo(50, y + 40).lineTo(550, y + 40).stroke();
    doc.fontSize(10).text('Terms & Conditions:', 50, y + 50);
    doc.fontSize(8).text('1. Helmet will be provided at the time of vehicle delivery.', 50, y + 70);
    doc.text('2. This is a standard helmet provided by the company.', 50, y + 85);
    
    doc.end();
    
    await AuditLog.create({
      action: 'GENERATE_PDF',
      entity: 'Booking',
      entityId: booking._id,
      user: req.user.id,
      ip: req.ip,
      metadata: { documentType: 'Helmet Invoice' },
      status: 'SUCCESS'
    });
    
  } catch (err) {
    console.error('Error generating helmet invoice:', err);
    
    await AuditLog.create({
      action: 'GENERATE_PDF',
      entity: 'Booking',
      entityId: req.params.id,
      user: req.user?.id,
      ip: req.ip,
      status: 'FAILED',
      error: err.message
    });
    
    res.status(500).json({
      success: false,
      message: 'Error generating helmet invoice',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

// Generate Accessories Challan
exports.generateAccessoriesChallan = async (req, res) => {
  try {
    const bookingId = req.params.id;
    const booking = await Booking.findById(bookingId)
      .populate('modelDetails')
      .populate('colorDetails')
      .populate('branchDetails')
      .populate('accessories.accessory');
    
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }
    
    if (booking.accessories.length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'No accessories found for this booking' 
      });
    }
    
    const doc = new PDFDocument({ margin: 50 });
    let filename = `AccessoriesChallan_${booking.bookingNumber}.pdf`;
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    
    doc.pipe(res);
    
    generatePDF(doc, booking, 'Accessories Challan');
    
    // Add accessories details
    doc.moveTo(50, 270).lineTo(550, 270).stroke();
    doc.fontSize(12).text('Accessories List:', 50, 280);
    
    let y = 300;
    booking.accessories.forEach(accessory => {
      doc.fontSize(10).text(`${accessory.accessory?.name || 'Accessory'}:`, 50, y);
      doc.text(`₹${accessory.price.toFixed(2)}`, 450, y, { align: 'right' });
      y += 15;
    });
    
    // Add totals
    doc.moveTo(50, y).lineTo(550, y).stroke();
    doc.fontSize(12).text('Total Amount:', 50, y + 10);
    doc.text(`₹${booking.accessoriesTotal.toFixed(2)}`, 450, y + 10, { align: 'right' });
    
    // Add footer
    doc.moveTo(50, y + 40).lineTo(550, y + 40).stroke();
    doc.fontSize(10).text('Terms & Conditions:', 50, y + 50);
    doc.fontSize(8).text('1. Accessories will be provided at the time of vehicle delivery.', 50, y + 70);
    doc.text('2. Please verify all accessories before accepting delivery.', 50, y + 85);
    
    doc.end();
    
    await AuditLog.create({
      action: 'GENERATE_PDF',
      entity: 'Booking',
      entityId: booking._id,
      user: req.user.id,
      ip: req.ip,
      metadata: { documentType: 'Accessories Challan' },
      status: 'SUCCESS'
    });
    
  } catch (err) {
    console.error('Error generating accessories challan:', err);
    
    await AuditLog.create({
      action: 'GENERATE_PDF',
      entity: 'Booking',
      entityId: req.params.id,
      user: req.user?.id,
      ip: req.ip,
      status: 'FAILED',
      error: err.message
    });
    
    res.status(500).json({
      success: false,
      message: 'Error generating accessories challan',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};