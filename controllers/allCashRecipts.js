// controllers/voucherController.js
const WorkShopReciptVoucher = require("../models/workshopReciptModel");
const CashVoucher = require("../models/CashVoucher");
const ContraVoucher = require("../models/ContraVoucherModel");
const moment = require("moment");
const { toWords } = require("number-to-words");


exports.getAllVouchers = async (req, res) => {
  try {
    const [workshopReceipts, cashVouchers, contraVouchers] = await Promise.all([
      WorkShopReciptVoucher.find().lean(),
      CashVoucher.find().lean(),
      ContraVoucher.find().lean()
    ]);

    // Add a type field for identification
    const allVouchers = [
      ...workshopReceipts.map(v => ({ ...v, voucherCategory: "WorkshopReceipt" })),
      ...cashVouchers.map(v => ({ ...v, voucherCategory: "CashVoucher" })),
      ...contraVouchers.map(v => ({ ...v, voucherCategory: "ContraVoucher" }))
    ];

    // Sort by createdAt descending
    allVouchers.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    res.status(200).json({
      success: true,
      count: allVouchers.length,
      data: allVouchers
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};



exports.getVoucherReceipt = async (req, res) => {
  try {
    const { id } = req.params;

    // Find voucher from any collection
    const [workshop, cash, contra] = await Promise.all([
      WorkShopReciptVoucher.findById(id).lean(),
      CashVoucher.findById(id).lean(),
      ContraVoucher.findById(id).lean()
    ]);

    const voucher = workshop || cash || contra;

    if (!voucher) {
      return res.status(404).send("Voucher not found");
    }

    const receiptData = {
      receiptNo: voucher.voucherId,
      receiptDate: moment(voucher.date).format("DD/MM/YYYY"),
      name: voucher.recipientName || "",
      expense: "RECEIPT",
      paymentMode: voucher.paymentMode || "CASH",
      narration: voucher.remark || "CASH",
      receivedAmount: voucher.amount,
      amountInWords: `(Rs. ${toWords(voucher.amount).replace(/\b\w/g, c => c.toUpperCase())} .)`,
      status: "COMPLETED"
    };

    // HTML Receipt (Double Copy Like Your Image)
    const html = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; }
    .receipt { width: 700px; margin: auto; border: 1px solid #000; padding: 15px; }
    .header { display: flex; justify-content: space-between; }
    .title { font-weight: bold; font-size: 20px; }
    .line { border-top: 1px solid #000; margin: 10px 0; }
    .bold { font-weight: bold; }
    table { width: 100%; }
    td { padding: 3px; }
    .footer { margin-top: 20px; display: flex; justify-content: space-between; font-size: 12px; }
  </style>
</head>
<body>

${generateReceiptBlock(receiptData)}
<hr style="margin: 40px 0; border-top: 1px dashed #000;">
${generateReceiptBlock(receiptData)}

</body>
</html>
`;

    res.setHeader("Content-Type", "text/html");
    res.send(html);
  } catch (error) {
    res.status(500).send(error.message);
  }
};

function generateReceiptBlock(data) {
  return `
<div class="receipt">
  <div class="header">
    <div class="title">TVS</div>
    <div><img src="https://via.placeholder.com/80" alt="Logo" /></div>
  </div>
  <p>Authorise Main Dealer : TVS Motor Company Ltd.<br>Registered office:-</p>
  <table>
    <tr><td>Receipt No</td><td>${data.receiptNo}</td><td>Receipt Date</td><td>${data.receiptDate}</td></tr>
    <tr><td>Name</td><td>${data.name}</td></tr>
    <tr><td>Expense</td><td>${data.expense}</td></tr>
    <tr><td>Payment Mode</td><td>${data.paymentMode}</td></tr>
    <tr><td>Narration</td><td>${data.narration}</td></tr>
  </table>
  <p>Received Amount (Rs) <b>${data.receivedAmount}</b><br>
  (In Words) ${data.amountInWords}</p>
  <p class="bold">${data.status}</p>
  <div class="footer">
    <div>For, Gandhi TVS</div>
    <div>Authorised Signatory</div>
  </div>
</div>
`;
}


exports.downloadVoucherReceipt = async (req, res) => {
  try {
    const { id } = req.params;

    // Search all voucher collections
    let voucher =
      (await WorkShopReciptVoucher.findById(id)) ||
      (await CashVoucher.findById(id)) ||
      (await ContraVoucher.findById(id));

    if (!voucher) {
      return res.status(404).json({ success: false, message: "Voucher not found" });
    }

    // Ensure values are safe
    const voucherDate = voucher.date ? new Date(voucher.date).toLocaleDateString() : "N/A";
    const voucherAmount = typeof voucher.amount === "number" ? voucher.amount : 0;
    const amountInWords = toWords(voucherAmount || 0);

    // PDF response headers
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=Receipt-${voucher.voucherId || id}.pdf`
    );
    res.setHeader("Content-Type", "application/pdf");

    const doc = new PDFDocument({ margin: 50 });

    // Handle PDF errors
    doc.on("error", (err) => {
      console.error("PDF generation error:", err);
      if (!res.headersSent) {
        res.status(500).json({ success: false, message: "Failed to generate PDF" });
      }
    });

    doc.pipe(res);

    // Title
    doc.fontSize(18).text("Account Customer Receipt", { align: "center" });
    doc.moveDown(0.5);

    // Basic Details
    doc.fontSize(10).text(`Voucher ID: ${voucher.voucherId || "N/A"}`);
    doc.text(`Date: ${voucherDate}`);
    doc.text(`Status: ${voucher.status || "N/A"}`);
    doc.moveDown(1);

    // Recipient Info
    doc.fontSize(12).text(`Recipient Name: ${voucher.recipientName || "N/A"}`);
    doc.text(`Voucher Type: ${voucher.voucherType || "N/A"}`);
    if (voucher.contraType) doc.text(`Contra Type: ${voucher.contraType}`);
    if (voucher.reciptType) doc.text(`Receipt Type: ${voucher.reciptType}`);
    doc.text(`Payment Mode: ${voucher.paymentMode || "N/A"}`);
    if (voucher.bankName) doc.text(`Bank Name: ${voucher.bankName}`);
    doc.text(`Location: ${voucher.bankLocation || voucher.cashLocation || "N/A"}`);
    doc.moveDown(1);

    // Amount
    doc.fontSize(12).text(`Amount: Rs. ${voucherAmount}`);
    doc.text(`Amount in Words: ${amountInWords}`, { italic: true });
    doc.moveDown(1);

    // Remark
    if (voucher.remark) doc.text(`Remark: ${voucher.remark}`);

    // Footer
    doc.moveDown(2);
    doc.fontSize(10).text("This is a system generated receipt.", { align: "center" });

    doc.end();

  } catch (error) {
    console.error("Error generating receipt:", error);
    if (!res.headersSent) {
      res.status(500).json({ success: false, message: "Server error" });
    }
  }
};
