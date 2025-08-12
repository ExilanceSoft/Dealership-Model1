const WorkShopReciptVoucher = require("../models/workshopReciptModel");
const CashVoucher = require("../models/CashVoucher");
const ContraVoucher = require("../models/ContraVoucherModel");
const fs = require("fs");
const path = require("path");
const Handlebars = require("handlebars");
const moment = require("moment");
const { toWords } = require("number-to-words");
const { generatePDFFromHtml } = require("../utils/pdfGenerator1");

exports.getAllVouchers = async (req, res) => {
  try {
    const [workshopReceipts, cashVouchers, contraVouchers] = await Promise.all([
      WorkShopReciptVoucher.find().lean(),
      CashVoucher.find().lean(),
      ContraVoucher.find().lean()
    ]);

    const allVouchers = [
      ...workshopReceipts.map(v => ({ ...v, voucherCategory: "WorkshopReceipt" })),
      ...cashVouchers.map(v => ({ ...v, voucherCategory: "CashVoucher" })),
      ...contraVouchers.map(v => ({ ...v, voucherCategory: "ContraVoucher" }))
    ];

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

Handlebars.registerHelper("formatDate", (date) => {
  return date ? moment(date).format("DD/MM/YYYY") : "N/A";
});

exports.downloadVoucherReceipt = async (req, res) => {
  try {
    const { id } = req.params;
    let voucher =
      (await WorkShopReciptVoucher.findById(id).lean()) ||
      (await CashVoucher.findById(id).lean()) ||
      (await ContraVoucher.findById(id).lean());

    if (!voucher) {
      return res.status(404).json({ success: false, message: "Voucher not found" });
    }

    const voucherAmount = typeof voucher.amount === "number" ? voucher.amount : 0;

    const templatePath = path.join(__dirname, "../templates/voucherRecipt.html");
    const templateHtml = fs.readFileSync(templatePath, "utf8");
    const compiledTemplate = Handlebars.compile(templateHtml);

    const htmlData = compiledTemplate({
      ...voucher,
      amountInWords: `${toWords(voucherAmount)} only`
    });

    const pdfBuffer = await generatePDFFromHtml(htmlData);

    res.setHeader("Content-Disposition", `attachment; filename="Receipt-${voucher.voucherId || id}.pdf"`);
    res.setHeader("Content-Type", "application/pdf");
    res.send(pdfBuffer);

  } catch (error) {
    console.error("Error generating voucher PDF:", error);
    res.status(500).json({ success: false, message: "Failed to generate PDF" });
  }
};