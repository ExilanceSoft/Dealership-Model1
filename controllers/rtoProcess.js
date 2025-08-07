const RtoProcess = require("../models/RtoProcessModel");
const AuditLog = require("../models/AuditLog");
const Booking = require("../models/Booking");


exports.createRtoProcess = async (req, res) => {
  try {
    const { bookingId, applicationNumber } = req.body;

    
    if (!bookingId || !applicationNumber) {
      return res.status(400).json({
        success: false,
        message: "Booking ID and Application Number are required",
      });
    }

    
    const appNumberRegex = /^[A-Za-z0-9\-\/]+$/;
    if (!appNumberRegex.test(applicationNumber)) {
      return res.status(400).json({
        success: false,
        message: "Invalid application number format",
      });
    }

    const existing = await RtoProcess.findOne({ bookingId });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: "RTO record for this booking ID already exists",
      });
    }

    const newRtoData = {
      bookingId: bookingId,
      applicationNumber,
      createdBy: req.user.id,
    };

    const rto = await RtoProcess.create(newRtoData);

    await Booking.findByIdAndUpdate(bookingId, { rtoStatus: "completed" });

    await AuditLog.create({
      action: "CREATE",
      entity: "RtoProcess",
      entityId: rto._id,
      user: req.user.id,
      ip: req.ip,
      metadata: newRtoData,
      status: "SUCCESS",
    });

    res.status(201).json({ success: true, data: rto });
  } catch (err) {
    console.error("Error creating RTO:", err);

    await AuditLog.create({
      action: "CREATE",
      entity: "RtoProcess",
      user: req.user?.id,
      ip: req.ip,
      metadata: req.body,
      status: "FAILED",
      error: err.message,
    });

    res.status(500).json({
      success: false,
      message: "Server error",
      error: err.message,
    });
  }
};

exports.getAllRtoProcesses = async (req, res) => {
  try {
    let rtos = await RtoProcess.find()
      .sort({ createdAt: -1 })
      .populate({
        path: "bookingId",
        select:
          "bookingNumber chassisNumber customerDetails.name customerDetails.mobile1 model",
        populate: {
          path: "model",
          select: "model_name type",
        },
      });

    rtos = rtos.map((item) => {
      const itemObj = item.toObject();
      const booking = itemObj.bookingId;

      if (booking) {
        itemObj.bookingId = {
          id: booking.id,
          bookingNumber: booking.bookingNumber,
          chassisNumber: booking.chassisNumber,
          customerName: booking.customerDetails?.name || '',
          customerMobile: booking.customerDetails?.mobile1 || '',
          model: booking.model ? {
            model_name: booking.model.model_name,
            type: booking.model.type,
          } : null
        };
      }

     
      delete itemObj.batteryNumber;
      delete itemObj.keyNumber;
      delete itemObj.motorNumber;
      delete itemObj.chargerNumber;
      delete itemObj.engineNumber;

      return itemObj;
    });

    res.status(200).json({
      success: true,
      count: rtos.length,
      data: rtos,
    });
  } catch (err) {
    console.error("Error fetching RTOs:", err);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: err.message,
    });
  }
};

exports.getAllRtoProcessRecords = async (req, res) => {
  try {
    // Find all RTO processes with basic population
    const rtoProcesses = await RtoProcess.find()
      .sort({ createdAt: -1 })
      .populate({
        path: "bookingId",
        select: "bookingNumber chassisNumber customerDetails.name customerDetails.mobile1 model",
        populate: {
          path: "model",
          select: "model_name type",
        },
      })
      .populate("createdBy", "name email") 
      .populate("updatedBy", "name email"); 

    res.status(200).json({
      success: true,
      count: rtoProcesses.length,
      data: rtoProcesses,
    });
  } catch (error) {
    console.error("Error fetching all RTO records:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

exports.getRtoProcessesWithApplicationNumbers = async (req, res) => {
  try {
    let rtoProcesses = await RtoProcess.find({
      applicationNumber: { $ne: null, $nin: [""] }, 
    }).populate({
      path: "bookingId",
      select: "bookingNumber chassisNumber customerDetails.name customerDetails.mobile1 model",
      populate: {
        path: "model",
        select: "model_name type",
      },
    });

    // Clean and flatten data
    rtoProcesses = rtoProcesses.map((item) => {
      const itemObj = item.toObject(); // convert mongoose doc to plain JS
      const booking = itemObj.bookingId;

      if (booking) {
        itemObj.bookingId = {
          id: booking.id,
          bookingNumber: booking.bookingNumber,
          chassisNumber: booking.chassisNumber,
          customerName: booking.customerDetails?.name || '',
          customerMobile: booking.customerDetails?.mobile1 || '',
          model: booking.model ? {
            model_name: booking.model.model_name,
            type: booking.model.type,
          } : null
        };
      }

      return itemObj;
    });

    res.status(200).json({
      success: true,
      data: rtoProcesses,
    });
  } catch (error) {
    console.error("Error fetching RTO records:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};


exports.getRtoProcessesWithRtoTaxPending = async (req, res) => {
  try {
    let rtoProcesses = await RtoProcess.find({
      rtoPendingTaxStatus: false,
    }).populate({
      path: "bookingId",
      select:
        "bookingNumber chassisNumber customerDetails.name customerDetails.mobile1 model",
      populate: {
        path: "model",
        select: "model_name type",
      },
    });

    
    rtoProcesses = rtoProcesses.map((item) => {
      const booking = item.bookingId;

      if (booking) {
        
        const flattenedBooking = {
          id: booking.id,
          bookingNumber: booking.bookingNumber,
          chassisNumber: booking.chassisNumber,
          customerName: booking.customerDetails?.name,
          customerMobile: booking.customerDetails?.mobile1,
          model: booking.model,
        };

        item = item.toObject();
        item.bookingId = flattenedBooking;
      }

      return item;
    });

    res.status(200).json({
      success: true,
      data: rtoProcesses,
    });
  } catch (error) {
    console.error("Error fetching RTO tax pending records:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

exports.getRtoProcessesWithRtoTaxCompleted = async (req, res) => {
  try {
    const rtoProcesses = await RtoProcess.find({
      rtoPendingTaxStatus: true,
    }).populate({
      path: "bookingId",
      select:
        "bookingNumber chassisNumber customerDetails.name customerDetails.mobile1 model",
      populate: {
        path: "model",
        select: "model_name type",
      },
    });

    const processedData = rtoProcesses.map((item) => {
      const booking = item.bookingId;

      if (booking) {
        const flattenedBooking = {
          id: booking._id,
          bookingNumber: booking.bookingNumber,
          chassisNumber: booking.chassisNumber,
          customerName: booking.customerDetails?.name,
          customerMobile: booking.customerDetails?.mobile1,
          model: booking.model,
        };

        const itemObj = item.toObject();
        itemObj.bookingId = flattenedBooking;
        return itemObj;
      }

      return item; // in case booking is null
    });

    res.status(200).json({
      success: true,
      data: processedData,
    });
  } catch (error) {
    console.error("Error fetching RTO tax completed records:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

exports.getRtoProcessesWithRtoPaperStatus = async (req, res) => {
  try {
    const rtoProcesses = await RtoProcess.find({
      rtoPaperStatus: { $nin: ["Not Submitted", "N/A"] },
    }).populate({
      path: "bookingId",
      select: "bookingNumber chassisNumber customerDetails.name customerDetails.mobile1 model",
      populate: {
        path: "model",
        select: "model_name type",
      },
    });

    const processedData = rtoProcesses.map((item) => {
      const booking = item.bookingId;

      if (booking) {
        const flattenedBooking = {
          id: booking._id,
          bookingNumber: booking.bookingNumber,
          chassisNumber: booking.chassisNumber,
          customerName: booking.customerDetails?.name,
          customerMobile: booking.customerDetails?.mobile1,
          model: booking.model,
        };

        const itemObj = item.toObject();
        itemObj.bookingId = flattenedBooking;
        return itemObj;
      }

      return item.toObject(); // Still convert it to a plain object
    });

    res.status(200).json({
      success: true,
      data: processedData,
    });
  } catch (error) {
    console.error("Error fetching RTO records:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};


exports.getRtoProcessesWithRtoPaperStatusAsNotSubmitted = async (req, res) => {
  try {
    const rtoProcesses = await RtoProcess.find({
      rtoPaperStatus: "Not Submitted",
    }).populate({
      path: "bookingId",
      select: "bookingNumber chassisNumber customerDetails.name customerDetails.mobile1 model",
      populate: {
        path: "model",
        select: "model_name type",
      },
    });

    const processedData = rtoProcesses.map((item) => {
      const booking = item.bookingId;

      if (booking) {
        const flattenedBooking = {
          id: booking._id,
          bookingNumber: booking.bookingNumber,
          chassisNumber: booking.chassisNumber,
          customerName: booking.customerDetails?.name,
          customerMobile: booking.customerDetails?.mobile1,
          model: booking.model,
        };

        const itemObj = item.toObject();
        itemObj.bookingId = flattenedBooking;
        return itemObj;
      }

      return item.toObject(); 
    });

    res.status(200).json({
      success: true,
      data: processedData,
    });
  } catch (error) {
    console.error("Error fetching RTO records:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

exports.getRtoProcessesWithHsrpOrderedStatus = async (req, res) => {
  try {
    const rtoProcesses = await RtoProcess.find({
      hsrbOrdering: { $ne: false },
    }).populate({
      path: "bookingId",
      select: "bookingNumber chassisNumber customerDetails.name customerDetails.mobile1 model",
      populate: {
        path: "model",
        select: "model_name type",
      },
    });

    const processedData = rtoProcesses.map((item) => {
      const booking = item.bookingId;

      if (booking) {
        const flattenedBooking = {
          id: booking._id,
          bookingNumber: booking.bookingNumber,
          chassisNumber: booking.chassisNumber,
          customerName: booking.customerDetails?.name,
          customerMobile: booking.customerDetails?.mobile1,
          model: booking.model,
        };

        const itemObj = item.toObject();
        itemObj.bookingId = flattenedBooking;
        return itemObj;
      }

      return item.toObject(); 
    });

    res.status(200).json({
      success: true,
      data: processedData,
    });
  } catch (error) {
    console.error("Error fetching RTO records:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

exports.getRtoProcessesWithHsrpInstallationStatus = async (req, res) => {
  try {
    const rtoProcesses = await RtoProcess.find({
      hsrbInstallation: { $ne: false },
    }).populate({
      path: "bookingId",
      select: "bookingNumber chassisNumber customerDetails.name customerDetails.mobile1 model",
      populate: {
        path: "model",
        select: "model_name type",
      },
    });

    const processedData = rtoProcesses.map((item) => {
      const booking = item.bookingId;

      if (booking) {
        const flattenedBooking = {
          id: booking._id,
          bookingNumber: booking.bookingNumber,
          chassisNumber: booking.chassisNumber,
          customerName: booking.customerDetails?.name,
          customerMobile: booking.customerDetails?.mobile1,
          model: booking.model,
        };

        const itemObj = item.toObject();
        itemObj.bookingId = flattenedBooking;
        return itemObj;
      }

      return item.toObject(); 
    });

    res.status(200).json({
      success: true,
      data: processedData,
    });
  } catch (error) {
    console.error("Error fetching RTO records:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

exports.getRtoProcessesWithHsrpOrderedStatusIsfalse = async (req, res) => {
  try {
    const rtoProcesses = await RtoProcess.find({
      hsrbOrdering: { $ne: true },
    }).populate({
      path: "bookingId",
      select: "bookingNumber chassisNumber customerDetails.name customerDetails.mobile1 model",
      populate: {
        path: "model",
        select: "model_name type",
      },
    });

    const processedData = rtoProcesses.map((item) => {
      const booking = item.bookingId;

      if (booking) {
        const flattenedBooking = {
          id: booking._id,
          bookingNumber: booking.bookingNumber,
          chassisNumber: booking.chassisNumber,
          customerName: booking.customerDetails?.name,
          customerMobile: booking.customerDetails?.mobile1,
          model: booking.model,
        };

        const itemObj = item.toObject();
        itemObj.bookingId = flattenedBooking;
        return itemObj;
      }

      return item.toObject(); 
    });
    res.status(200).json({
      success: true,
      data: processedData,
    });
  } catch (error) {
    console.error("Error fetching RTO records:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

exports.getRtoProcessesWithHsrpInstallationStatusIsfalse = async (req, res) => {
  try {
    const rtoProcesses = await RtoProcess.find({
      hsrbInstallation: { $ne: true },
    }).populate({
      path: "bookingId",
      select: "bookingNumber chassisNumber customerDetails.name customerDetails.mobile1 model",
      populate: {
        path: "model",
        select: "model_name type",
      },
    });

    const processedData = rtoProcesses.map((item) => {
      const booking = item.bookingId;

      if (booking) {
        const flattenedBooking = {
          id: booking._id,
          bookingNumber: booking.bookingNumber,
          chassisNumber: booking.chassisNumber,
          customerName: booking.customerDetails?.name,
          customerMobile: booking.customerDetails?.mobile1,
          model: booking.model,
        };

        const itemObj = item.toObject();
        itemObj.bookingId = flattenedBooking;
        return itemObj;
      }

      return item.toObject(); 
    });

    res.status(200).json({
      success: true,
      data: processedData,
    });
  } catch (error) {
    console.error("Error fetching RTO records:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

exports.getRtoProcessesWithRcConfirmationStatus = async (req, res) => {
  try {
    const rtoProcesses = await RtoProcess.find({
      rcConfirmation: { $ne: false },
    }).populate({
      path: "bookingId",
      select: "bookingNumber chassisNumber customerDetails.name customerDetails.mobile1 model",
      populate: {
        path: "model",
        select: "model_name type",
      },
    });

    const processedData = rtoProcesses.map((item) => {
      const booking = item.bookingId;

      if (booking) {
        const flattenedBooking = {
          id: booking._id,
          bookingNumber: booking.bookingNumber,
          chassisNumber: booking.chassisNumber,
          customerName: booking.customerDetails?.name,
          customerMobile: booking.customerDetails?.mobile1,
          model: booking.model,
        };

        const itemObj = item.toObject();
        itemObj.bookingId = flattenedBooking;
        return itemObj;
      }

      return item.toObject(); 
    });

    res.status(200).json({
      success: true,
      data: processedData,
    });
  } catch (error) {
    console.error("Error fetching RTO records:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

exports.getRtoProcessesWithRcConfirmationStatusIsfalse = async (req, res) => {
  try {
    const rtoProcesses = await RtoProcess.find({
      rcConfirmation: { $ne: true },
    }).populate({
      path: "bookingId",
      select: "bookingNumber chassisNumber customerDetails.name customerDetails.mobile1 model",
      populate: {
        path: "model",
        select: "model_name type",
      },
    });

    const processedData = rtoProcesses.map((item) => {
      const booking = item.bookingId;

      if (booking) {
        const flattenedBooking = {
          id: booking._id,
          bookingNumber: booking.bookingNumber,
          chassisNumber: booking.chassisNumber,
          customerName: booking.customerDetails?.name,
          customerMobile: booking.customerDetails?.mobile1,
          model: booking.model,
        };

        const itemObj = item.toObject();
        itemObj.bookingId = flattenedBooking;
        return itemObj;
      }

      return item.toObject(); 
    });

    res.status(200).json({
      success: true,
      data: processedData,
    });
  } catch (error) {
    console.error("Error fetching RTO records:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

exports.getRtoProcessById = async (req, res) => {
  try {
    let rto = await RtoProcess.findById(req.params.id).populate({
      path: "bookingId",
      select:
        "bookingNumber chassisNumber customerDetails.name customerDetails.mobile1 model",
      populate: {
        path: "model",
        select: "model_name type",
      },
    });

    if (!rto) {
      return res.status(404).json({ success: false, message: "RTO not found" });
    }

    // Flatten bookingId object
    const booking = rto.bookingId;
    if (booking) {
      const flattenedBooking = {
        id: booking.id,
        bookingNumber: booking.bookingNumber,
        chassisNumber: booking.chassisNumber,
        customerName: booking.customerDetails?.name,
        customerMobile: booking.customerDetails?.mobile1,
        model: booking.model,
      };

      rto = rto.toObject(); // convert to plain object
      rto.bookingId = flattenedBooking;
    }

    res.status(200).json({ success: true, data: rto });
  } catch (err) {
    console.error("Error fetching RTO:", err);
    res
      .status(500)
      .json({ success: false, message: "Server error", error: err.message });
  }
};



exports.updateRtoProcess = async (req, res) => {
  try {
    const updates = req.body;

    const rto = await RtoProcess.findByIdAndUpdate(
      req.params.id,
      { $set: updates },
      { new: true, runValidators: true }
    );

    if (!rto) {
      return res.status(404).json({ success: false, message: "RTO not found" });
    }

    await AuditLog.create({
      action: "UPDATE",
      entity: "RtoProcess",
      entityId: rto._id,
      user: req.user.id,
      ip: req.ip,
      metadata: updates,
      status: "SUCCESS",
    });

    res.status(200).json({ success: true, data: rto });
  } catch (err) {
    console.error("Error updating RTO:", err);
    await AuditLog.create({
      action: "UPDATE",
      entity: "RtoProcess",
      entityId: req.params.id,
      user: req.user?.id,
      ip: req.ip,
      metadata: req.body,
      status: "FAILED",
      error: err.message,
    });
    res
      .status(500)
      .json({ success: false, message: "Server error", error: err.message });
  }
};



exports.updateMultipleRtoProcessesTaxDetails = async (req, res) => {
  try {
    const { updates, receiptNumber } = req.body;

    if (!receiptNumber || !Array.isArray(updates)) {
      return res.status(400).json({
        success: false,
        message: "Invalid input: receiptNumber and updates are required",
      });
    }

    const updatePromises = updates.map((item) =>
      RtoProcess.findByIdAndUpdate(
        item.rtoId,
        {
          rtoAmount: item.rtoAmount,
          numberPlate: item.numberPlate,
          receiptNumber: receiptNumber,
          rtoPendingTaxStatus: true

        },
        { new: true }
      )
    );

    const updatedRecords = await Promise.all(updatePromises);

    res.status(200).json({
      success: true,
      message: "RTO Processes updated successfully",
      data: updatedRecords,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Server Error",
      error: error.message,
    });
  }
};




exports.deleteRtoProcess = async (req, res) => {
  try {
    const rto = await RtoProcess.findByIdAndDelete(req.params.id);

    if (!rto) {
      return res.status(404).json({ success: false, message: "RTO not found" });
    }

    await AuditLog.create({
      action: "DELETE",
      entity: "RtoProcess",
      entityId: rto._id,
      user: req.user.id,
      ip: req.ip,
      metadata: { bookingId: rto.bookingId },
      status: "SUCCESS",
    });

    res
      .status(200)
      .json({ success: true, message: "RTO deleted successfully" });
  } catch (err) {
    console.error("Error deleting RTO:", err);
    await AuditLog.create({
      action: "DELETE",
      entity: "RtoProcess",
      entityId: req.params.id,
      user: req.user?.id,
      ip: req.ip,
      metadata: req.body,
      status: "FAILED",
      error: err.message,
    });
    res
      .status(500)
      .json({ success: false, message: "Server error", error: err.message });
  }
};


exports.getRtoProcessStats = async (req, res) => {
  try {
    const today = new Date();
    const startOfDay = new Date(today.setHours(0, 0, 0, 0));
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    const getCount = async (filter = {}) => {
      const total = await RtoProcess.countDocuments(filter);
      const monthly = await RtoProcess.countDocuments({
        ...filter,
        updatedAt: { $gte: startOfMonth },
      });
      const daily = await RtoProcess.countDocuments({
        ...filter,
        updatedAt: { $gte: startOfDay },
      });
      return { total, monthly, daily };
    };

    const stats = {
      totalApplications: await getCount(),
      rtoPaperVerify: await getCount({ rtoPaperStatus: { $nin: ["Not Submitted", "N/A"] } }),
      rtoTaxVerify: await getCount({ rtoPendingTaxStatus: true }),
      rtoTaxUpdate: await getCount({ receiptNumber: { $ne: null } }),
      hsrpOrdering: await getCount({ hsrbOrdering: true }),
      hsrpInstallation: await getCount({ hsrbInstallation: true }),
      rcConfirmation: await getCount({ rcConfirmation: true }),
    };

    res.status(200).json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error("Error getting RTO stats:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};
