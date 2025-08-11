
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const Handlebars = require('handlebars');
const moment = require('moment');
const Booking = require('../models/Booking');
const Model = require('../models/ModelModel');
const Header = require('../models/HeaderModel');
const Accessory = require('../models/Accessory');
const Broker = require('../models/Broker');
const FinanceProvider = require('../models/FinanceProvider');
const FinancerRate = require('../models/FinancerRate');
const AuditLog = require('../models/AuditLog');
const User = require('../models/User');
const Color = require('../models/Color');
const { generatePDFFromHtml } = require('../utils/pdfGenerator1');
const qrController = require('../controllers/qrController');
const Vehicle = require('../models/vehicleInwardModel');
const KYC = require('../models/KYC');
const FinanceLetter = require('../models/FinanceLetter');



// const validateSalesExecutive = require('../middleware/validateSalesExecutive');
// Configure Handlebars helpers
Handlebars.registerHelper('formatDate', function(date) {
    return moment(date).format('DD/MM/YYYY');
});
Handlebars.registerHelper('formatCurrency', function(amount) {
    if (amount === undefined || amount === null) return '0.00';
    return parseFloat(amount).toFixed(2);
});
Handlebars.registerHelper('calculateTax', function(amount, rate) {
    if (!amount || !rate) return '0.00';
    return (amount * rate / 100).toFixed(2);
});

Handlebars.registerHelper('add', function() {
    return Array.from(arguments).reduce((sum, num) => {
        if (typeof num === 'number') return sum + num;
        return sum;
    }, 0);
});

Handlebars.registerHelper('subtract', function(a, b) {
    return a - b;
});

Handlebars.registerHelper('eq', function(a, b) {
    return a === b;
});

Handlebars.registerHelper('gt', function(a, b) {
    return a > b;
});

Handlebars.registerHelper('divide', function(a, b) {
    return a / b;
});

Handlebars.registerHelper('formatDate', function(date) {
  return moment(date).format('DD/MM/YYYY');
});

Handlebars.registerHelper('formatCurrency', function(amount) {
  if (amount === undefined || amount === null) return '0.00';
  return parseFloat(amount).toFixed(2);
});
// Load the booking form template
const templatePath = path.join(__dirname, '../templates/bookingFormTemplate.html');
const templateHtml = fs.readFileSync(templatePath, 'utf8');
const bookingFormTemplate = Handlebars.compile(templateHtml);
// Helper function to generate booking form PDF
// const generateBookingFormPDF = async (booking) => {
//     try {
//         // Prepare data for the template
//         const formData = {
//             ...booking.toObject(),
//             branchDetails: booking.branchDetails,
//             modelDetails: booking.modelDetails,
//             colorDetails: booking.colorDetails,
//             salesExecutiveDetails: booking.salesExecutiveDetails,
//             createdAt: booking.createdAt,
//             bookingNumber: booking.bookingNumber
//         };

//         // Generate HTML content
//         const html = bookingFormTemplate(formData);

//         // Convert HTML to PDF buffer
//         const pdfBuffer = await generatePDFFromHtml(html);

//         // Define upload directory path
//         const uploadDir = path.join(process.cwd(), 'uploads', 'booking-forms');
        
//         // Create directory if it doesn't exist
//         if (!fs.existsSync(uploadDir)) {
//             fs.mkdirSync(uploadDir, { recursive: true });
//         }

//         // Generate unique filename
//         const fileName = `booking-form-${booking.bookingNumber}-${Date.now()}.pdf`;
        
//         // Create full file path
//         const filePath = path.join(uploadDir, fileName);

//         // Write PDF file
//         fs.writeFileSync(filePath, pdfBuffer);

//         // Return file information
//         return {
//             path: filePath,
//             fileName: fileName,
//             url: `/uploads/booking-forms/${fileName}`
//         };
//     } catch (error) {
//         console.error('Error generating booking form PDF:', error);
//         throw error;
//     }
// };

const generateBookingFormHTML = async (booking, saveToFile = true) => {
    try {
        // Prepare data for the template
        const formData = {
            ...booking.toObject(),
            branchDetails: booking.branchDetails,
            modelDetails: booking.modelDetails,
            colorDetails: booking.colorDetails,
            salesExecutiveDetails: booking.salesExecutiveDetails,
            createdAt: booking.createdAt,
            bookingNumber: booking.bookingNumber
        };

        // Generate HTML content
        const html = bookingFormTemplate(formData);

        if (!saveToFile) {
            return html;
        }

        // Define upload directory path
        const uploadDir = path.join(process.cwd(), 'uploads', 'booking-forms');
        
        // Create directory if it doesn't exist
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }

        // Generate unique filename with timestamp to avoid overwriting
        const fileName = `booking-form-${booking.bookingNumber}-${Date.now()}.html`;
        
        // Create full file path
        const filePath = path.join(uploadDir, fileName);

        // Write HTML file
        fs.writeFileSync(filePath, html);

        // Return file information
        return {
            path: filePath,
            fileName: fileName,
            url: `/uploads/booking-forms/${fileName}`
        };
    } catch (error) {
        console.error('Error generating booking form HTML:', error);
        throw error;
    }
};
// Helper function to calculate discounts
const calculateDiscounts = (priceComponents, discountAmount, discountType) => {
    const eligibleComponents = priceComponents.filter(c => 
        c.isDiscountable && c.headerDetails?.header_key !== 'HYPOTHECATION CHARGES (IF APPLICABLE)'
    );

    if (eligibleComponents.length === 0 && discountAmount > 0) {
        throw new Error('No discountable components available');
    }

    eligibleComponents.sort((a, b) => {
        const gstA = a.headerDetails?.metadata?.gst_rate || 0;
        const gstB = b.headerDetails?.metadata?.gst_rate || 0;
        return gstB - gstA;
    });

    const totalEligible = eligibleComponents.reduce((sum, c) => sum + c.originalValue, 0);
    let remainingDiscount = discountType === 'PERCENTAGE'
        ? (totalEligible * discountAmount) / 100 
        : discountAmount;

    return priceComponents.map(component => {
        if (component.headerDetails?.header_key === 'HYPOTHECATION CHARGES (IF APPLICABLE)') {
            return component;
        }
        
        if (!component.isDiscountable) {
            return component;
        }

        const targetComponent = eligibleComponents.find(c => c.header === component.header);
        if (!targetComponent || remainingDiscount <= 0) {
            return component;
        }

        const maxDiscount = component.originalValue * 0.95;
        const desiredDiscount = Math.min(maxDiscount, remainingDiscount);
        remainingDiscount -= desiredDiscount;

        return {
            ...component,
            discountedValue: component.originalValue - desiredDiscount
        };
    });
};
const validateDiscountLimits = (priceComponents) => {
    const violations = priceComponents.filter(
        c => c.isDiscountable && 
             c.headerDetails?.header_key !== 'HYPOTHECATION CHARGES (IF APPLICABLE)' &&
             c.discountedValue < (0.05 * c.originalValue)
    );

    if (violations.length > 0) {
        const itemNames = violations.map(v => v.headerDetails?.header_key).join(', ');
        throw new Error(`Discount cannot exceed 95% for: ${itemNames}`);
    }
};
exports.createBooking = async (req, res) => {
    try {
        // Validate required fields
        const requiredFields = [
            { field: 'model_id', message: 'Model selection is required' },
            { field: 'model_color', message: 'Color selection is required' },
            { field: 'customer_type', message: 'Customer type (B2B/B2C/CSD) is required' },
            { field: 'rto_type', message: 'RTO state (MH/BH/CRTM) is required' },
            { field: 'customer_details', message: 'Customer details are required' },
            { field: 'payment', message: 'Payment details are required' }
        ];
        
        const missingFields = requiredFields.filter(item => !req.body[item.field]);
        if (missingFields.length > 0) {
            return res.status(400).json({
                success: false,
                message: `Missing required fields: ${missingFields.map(f => f.message).join(', ')}`
            });
        }

        // Validate customer type
        if (!['B2B', 'B2C', 'CSD'].includes(req.body.customer_type)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid customer type. Must be B2B, B2C, or CSD'
            });
        }

        // Check user permissions and branch
        const isSuperAdmin = req.user.roles.some(r => r.isSuperAdmin);
        let branchId = req.body.branch;
        
        if (!isSuperAdmin) {
            if (!req.user.branch) {
                return res.status(400).json({
                    success: false,
                    message: 'Your account is not associated with any branch'
                });
            }
            branchId = req.user.branch;
            
            if (req.body.branch && req.body.branch.toString() !== req.user.branch.toString()) {
                return res.status(403).json({
                    success: false,
                    message: 'You can only create bookings for your own branch'
                });
            }
        } else {
            if (!req.body.branch) {
                return res.status(400).json({
                    success: false,
                    message: 'Branch selection is required'
                });
            }
            
            const branchExists = await mongoose.model('Branch').exists({ _id: req.body.branch });
            if (!branchExists) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid branch selected'
                });
            }
        }

        // Sales Executive Validation
        const currentUser = await User.findById(req.user.id).populate('roles');
        const isCurrentUserSalesExecutive = currentUser.roles.some(r => r.name === 'SALES_EXECUTIVE');

        // Handle sales executive selection
        if (req.body.sales_executive) {
            if (!mongoose.Types.ObjectId.isValid(req.body.sales_executive)) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid sales executive ID format'
                });
            }

            const salesExecutive = await User.findById(req.body.sales_executive).populate('roles');
            
            if (!salesExecutive || salesExecutive.status !== 'ACTIVE') {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid or inactive sales executive selected'
                });
            }

            const isSelectedUserSalesExecutive = salesExecutive.roles.some(r => r.name === 'SALES_EXECUTIVE');
            
            if (!isSelectedUserSalesExecutive) {
                return res.status(400).json({
                    success: false,
                    message: 'Selected user must have SALES_EXECUTIVE role'
                });
            }

            if (!salesExecutive.branch || salesExecutive.branch.toString() !== branchId.toString()) {
                return res.status(400).json({
                    success: false,
                    message: 'Sales executive must belong to the selected branch'
                });
            }

            // Check if selected sales executive is frozen
            if (salesExecutive.isFrozen) {
                return res.status(400).json({
                    success: false,
                    message: `Selected sales executive is frozen due to: ${salesExecutive.freezeReason}`
                });
            }
        } else if (!isSuperAdmin) {
            // Default to current user if not specified and user is sales executive
            if (isCurrentUserSalesExecutive) {
                req.body.sales_executive = req.user.id;
            } else {
                return res.status(400).json({
                    success: false,
                    message: 'Sales executive selection is required'
                });
            }
        }
        // Check if current sales executive is frozen (when creating own booking)
        if (isCurrentUserSalesExecutive && currentUser.isFrozen) {
            return res.status(400).json({
                success: false,
                message: `Your account is frozen due to: ${currentUser.freezeReason}. Please submit pending documents before creating new bookings.`
            });
        }
        // Check for pending documents if current user is sales executive
        if (isCurrentUserSalesExecutive) {
            const latestBooking = await Booking.findOne({
                $or: [
                    { createdBy: req.user.id },
                    { salesExecutive: req.user.id }
                ],
                status: { $in: ['PENDING_APPROVAL'] }
            }).sort({ createdAt: -1 });

            if (latestBooking) {
                const [kyc, financeLetter] = await Promise.all([
                    KYC.findOne({ booking: latestBooking._id }),
                    latestBooking.payment.type === 'FINANCE' 
                        ? FinanceLetter.findOne({ booking: latestBooking._id })
                        : Promise.resolve(null)
                ]);

                const missingDocuments = [];
                if (!kyc || kyc.status !== 'NOT_SUBMITTED') missingDocuments.push('KYC');
                if (latestBooking.payment.type === 'FINANCE' && (!financeLetter || financeLetter.status !== 'NOT_SUBMITTED')) {
                    missingDocuments.push('Finance Letter');
                }

                if (missingDocuments.length > 0) {
                    const now = new Date();
                    if (currentUser.documentBufferTime && now > currentUser.documentBufferTime) {
                        return res.status(400).json({
                            success: false,
                            message: `You have pending document submissions for booking ${latestBooking.bookingNumber}. Please submit all required documents before creating new bookings.`
                        });
                    }
                }
            }
        }

        // Validate salutation
        const validSalutations = ['Mr.', 'Mrs.', 'Miss', 'Dr.', 'Prof.'];
        if (!req.body.customer_details.salutation || 
            !validSalutations.includes(req.body.customer_details.salutation)) {
            return res.status(400).json({
                success: false,
                message: 'Valid salutation (Mr., Mrs., Miss, Dr., Prof.) is required'
            });
        }

        // Validate model and color
        const model = await Model.findById(req.body.model_id).populate('colors');
        if (!model) {
            return res.status(400).json({
                success: false,
                message: 'Invalid model selected'
            });
        }

        // Check if model type matches customer type for CSD
        if (req.body.customer_type === 'CSD' && model.type !== 'CSD') {
            return res.status(400).json({
                success: false,
                message: 'Selected model is not available for CSD customers'
            });
        }

        const color = await Color.findById(req.body.model_color);
        if (!color || !model.colors.some(c => c._id.toString() === req.body.model_color.toString())) {
            return res.status(400).json({
                success: false,
                message: 'Invalid color selected'
            });
        }

        // Validate GSTIN for B2B (not required for CSD)
        if (req.body.customer_type === 'B2B' && !req.body.gstin) {
            return res.status(400).json({
                success: false,
                message: 'GSTIN is required for B2B customers'
            });
        }

        // Get all headers for the model type
        const headers = await Header.find({ type: model.type }).sort({ priority: 1 });

        // Create price components with mandatory/optional handling
        const priceComponents = await Promise.all(headers.map(async (header) => {
            const priceData = model.prices.find(
                p => p.header_id.equals(header._id) && p.branch_id.equals(branchId)
            );

            // Skip if no price data found for this branch
            if (!priceData) return null;

            // Special handling for hypothecation charges
            if (header.header_key === 'HYPOTHECATION CHARGES (IF APPLICABLE)') {
                return {
                    header: header._id,
                    headerDetails: header,
                    originalValue: priceData.value,
                    discountedValue: req.body.hpa ? priceData.value : 0,
                    isDiscountable: false,
                    isMandatory: false,
                    metadata: priceData.metadata || {}
                };
            }

            // Handle mandatory components - always include these
            if (header.is_mandatory) {
                return {
                    header: header._id,
                    headerDetails: header,
                    originalValue: priceData.value,
                    discountedValue: priceData.value,
                    isDiscountable: header.is_discount,
                    isMandatory: true,
                    metadata: priceData.metadata || {}
                };
            }

            // Handle optional components - only include if explicitly selected
            if (req.body.optionalComponents && 
                Array.isArray(req.body.optionalComponents) &&
                req.body.optionalComponents.includes(header._id.toString())) {
                return {
                    header: header._id,
                    headerDetails: header,
                    originalValue: priceData.value,
                    discountedValue: priceData.value,
                    isDiscountable: header.is_discount,
                    isMandatory: false,
                    metadata: priceData.metadata || {}
                };
            }

            // Skip all other optional components that weren't selected
            return null;
        }));

        // Filter out null components
        const filteredComponents = priceComponents.filter(c => c !== null);

        // Verify at least one price component exists
        if (filteredComponents.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'No valid price components found for this model and branch'
            });
        }

        // Calculate base amount using filtered components
        const baseAmount = filteredComponents.reduce((sum, c) => sum + c.discountedValue, 0);

        // Set HPA charges
        const hpaHeader = headers.find(h => h.header_key === 'HYPOTHECATION CHARGES (IF APPLICABLE)');
        const hypothecationCharges = req.body.hpa 
            ? (model.prices.find(
                p => p.header_id.equals(hpaHeader?._id) && p.branch_id.equals(branchId))
                )?.value || 0 
            : 0;

        // Set RTO amount
        let rtoAmount = 0;
        if (['BH', 'CRTM'].includes(req.body.rto_type)) {
            rtoAmount = req.body.rto_type === 'BH' ? 5000 : 4500;
        }

        // Handle accessories
        let accessoriesTotal = 0;
        let accessories = [];

        if (req.body.accessories?.selected?.length > 0) {
            const accessoryIds = req.body.accessories.selected.map(acc => {
                if (!mongoose.Types.ObjectId.isValid(acc.id)) {
                    return res.status(400).json({
                        success: false,
                        message: `Invalid accessory ID: ${acc.id}`
                    });
                }
                return new mongoose.Types.ObjectId(acc.id);
            });

            const validAccessories = await Accessory.find({
                _id: { $in: accessoryIds },
                status: 'active'
            }).lean();

            if (validAccessories.length !== req.body.accessories.selected.length) {
                const missingIds = req.body.accessories.selected
                    .filter(a => !validAccessories.some(v => v._id.toString() === a.id))
                    .map(a => a.id);
                return res.status(400).json({
                    success: false,
                    message: `Invalid accessory IDs: ${missingIds.join(', ')}`
                });
            }

            const incompatibleAccessories = validAccessories.filter(
                a => !a.applicable_models.some(m => m.toString() === req.body.model_id.toString())
            );
            if (incompatibleAccessories.length > 0) {
                return res.status(400).json({
                    success: false,
                    message: `Incompatible accessories: ${
                        incompatibleAccessories.map(a => a.name).join(', ')
                    }`
                });
            }

            const accessoriesTotalHeader = await Header.findOne({
                header_key: 'ACCESSORIES TOTAL',
                type: model.type
            });
            if (!accessoriesTotalHeader) {
                return res.status(400).json({
                    success: false,
                    message: 'ACCESSORIES TOTAL header not configured'
                });
            }

            const accessoriesTotalPrice = model.prices.find(
                p => p.header_id.equals(accessoriesTotalHeader._id) && 
                    p.branch_id.equals(branchId)
            )?.value || 0;

            const selectedAccessoriesTotal = validAccessories.reduce(
                (sum, acc) => sum + acc.price, 
                0
            );

            accessoriesTotal = Math.max(selectedAccessoriesTotal, accessoriesTotalPrice);
            
            accessories = validAccessories.map(acc => ({
                accessory: acc._id,
                price: acc.price,
                discount: 0
            }));

            if (selectedAccessoriesTotal < accessoriesTotalPrice) {
                const difference = accessoriesTotalPrice - selectedAccessoriesTotal;
                accessories.push({
                    accessory: null, 
                    price: difference,
                    discount: 0
                });
            }
        }

        // Handle exchange
        let exchangeDetails = null;
        if (req.body.exchange?.is_exchange) {
            if (!req.body.exchange.broker_id) {
                return res.status(400).json({
                    success: false,
                    message: 'Broker selection is required for exchange'
                });
            }

            const broker = await Broker.findById(req.body.exchange.broker_id);
            if (!broker) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid broker selected'
                });
            }

            if (!broker.branches.some(b => b.branch.equals(branchId))) {
                return res.status(400).json({
                    success: false,
                    message: 'Broker not available for this branch'
                });
            }

            exchangeDetails = {
                broker: req.body.exchange.broker_id,
                price: req.body.exchange.exchange_price,
                vehicleNumber: req.body.exchange.vehicle_number,
                chassisNumber: req.body.exchange.chassis_number
            };
        }

        // Handle payment
        let payment = {};
        if (req.body.payment.type.toLowerCase() === 'finance') {
            if (!req.body.payment.financer_id) {
                return res.status(400).json({
                    success: false,
                    message: 'Financer selection is required'
                });
            }

            const financer = await FinanceProvider.findById(req.body.payment.financer_id);
            if (!financer) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid financer selected'
                });
            }

            let gcAmount = 0;
            if (req.body.payment.gc_applicable) {
                const financerRate = await FinancerRate.findOne({
                    financeProvider: req.body.payment.financer_id,
                    branch: branchId,
                    is_active: true
                });

                if (!financerRate) {
                    return res.status(400).json({
                        success: false,
                        message: 'Financer rate not found for this branch'
                    });
                }

                gcAmount = (baseAmount * financerRate.gcRate) / 100;
            }

            payment = {
                type: 'FINANCE',
                financer: req.body.payment.financer_id,
                scheme: req.body.payment.scheme || null,
                emiPlan: req.body.payment.emi_plan || null,
                gcApplicable: req.body.payment.gc_applicable,
                gcAmount: gcAmount
            };
        } else {
            payment = {
                type: 'CASH'
            };
        }

        // Check discount scenarios
        const modelHasDiscount = model.model_discount && model.model_discount > 0;
        const userDiscountLimit = isCurrentUserSalesExecutive ? (req.user.discount || 0) : 0;
        const isApplyingDiscount = req.body.discount && req.body.discount.value > 0;
        const discountExceedsLimit = isApplyingDiscount && req.body.discount.value > userDiscountLimit;

        // Initialize variables for status and form generation
        let status = 'DRAFT';
        let requiresApproval = false;
        let approvalNote = '';

        // Determine status based on discount scenarios
        if (modelHasDiscount) {
            status = 'PENDING_APPROVAL';
            requiresApproval = true;
            approvalNote = 'Model discount requires approval';
        } else if (isApplyingDiscount) {
            if (isCurrentUserSalesExecutive) {
                if (discountExceedsLimit) {
                    status = 'PENDING_APPROVAL (Discount_Exceeded)';
                    requiresApproval = true;
                    approvalNote = 'Discount exceeds sales executive limit';
                } else {
                    status = 'PENDING_APPROVAL';
                    requiresApproval = true;
                    approvalNote = 'Discount within limit requires approval';
                }
            } else {
                // Non-sales executive applying discount - requires approval
                status = 'PENDING_APPROVAL';
                requiresApproval = true;
                approvalNote = 'Discount requires approval (non-SALES_EXECUTIVE user)';
            }
        } else {
            // No discounts - status remains DRAFT
            status = 'DRAFT';
        }

        // Apply discounts if any
        let discounts = [];
        let totalDiscount = 0;
        
        if (modelHasDiscount) {
            discounts.push({
                amount: model.model_discount,
                type: 'FIXED',
                approvalStatus: 'PENDING',
                approvalNote: 'Model discount',
                isModelDiscount: true,
                appliedOn: new Date()
            });
        }

        if (isApplyingDiscount) {
            discounts.push({
                amount: req.body.discount.value,
                type: req.body.discount.type === 'percentage' ? 'PERCENTAGE' : 'FIXED',
                approvalStatus: 'PENDING',
                approvalNote: discountExceedsLimit ? 'Discount exceeds limit' : 'Discount within limit',
                isModelDiscount: false,
                appliedOn: new Date()
            });
        }

        // Calculate all discounts if any exist
        if (discounts.length > 0) {
            let updatedComponents = [...filteredComponents];
            
            for (const discount of discounts) {
                updatedComponents = calculateDiscounts(updatedComponents, discount.amount, discount.type);
                validateDiscountLimits(updatedComponents);
            }

            // Update components with discounted values
            updatedComponents.forEach(updated => {
                const original = filteredComponents.find(c => c.header?.toString() === updated.header?.toString());
                if (original) {
                    original.discountedValue = updated.discountedValue;
                }
            });

            totalDiscount = filteredComponents.reduce((sum, component) => {
                return sum + (component.originalValue - component.discountedValue);
            }, 0);
        }

        // Calculate total amounts
        const totalAmount = baseAmount + accessoriesTotal + rtoAmount;
        const discountedAmount = totalAmount - totalDiscount;

        // Create booking
        const bookingData = {
            model: req.body.model_id,
            color: req.body.model_color,
            customerType: req.body.customer_type,
            isCSD: req.body.customer_type === 'CSD',
            gstin: req.body.gstin || '',
            rto: req.body.rto_type,
            rtoAmount: ['BH', 'CRTM'].includes(req.body.rto_type) ? rtoAmount : undefined,
            hpa: req.body.hpa || false,
            hypothecationCharges: hypothecationCharges,
            insuranceStatus: 'AWAITING',
            customerDetails: {
                salutation: req.body.customer_details.salutation,
                name: req.body.customer_details.name,
                panNo: req.body.customer_details.pan_no || '',
                dob: req.body.customer_details.dob,
                occupation: req.body.customer_details.occupation,
                address: req.body.customer_details.address,
                taluka: req.body.customer_details.taluka,
                district: req.body.customer_details.district,
                pincode: req.body.customer_details.pincode,
                mobile1: req.body.customer_details.mobile1,
                mobile2: req.body.customer_details.mobile2 || '',
                aadharNumber: req.body.customer_details.aadhar_number || '',
                nomineeName: req.body.customer_details.nomineeName || undefined,
                nomineeRelation: req.body.customer_details.nomineeRelation || undefined,
                nomineeAge: req.body.customer_details.nomineeAge ? parseInt(req.body.customer_details.nomineeAge) : undefined
            },
            exchange: req.body.exchange ? req.body.exchange.is_exchange : false,
            exchangeDetails: exchangeDetails,
            payment: payment,
            accessories: accessories,
            priceComponents: filteredComponents,
            discounts: discounts,
            accessoriesTotal: accessoriesTotal,
            totalAmount: totalAmount,
            discountedAmount: discountedAmount,
            status: status,
            branch: branchId,
            createdBy: req.user.id,
            salesExecutive: req.body.sales_executive || req.user.id,
            formGenerated: false,
            formPath: ''
        };

        const booking = await Booking.create(bookingData);
        const qrCode = await qrController.generateQRCode(booking._id);
        booking.qrCode = qrCode;
        await booking.save();

        // Handle sales executive document buffer time
        if (isCurrentUserSalesExecutive) {
            await User.findByIdAndUpdate(req.user.id, {
                documentBufferTime: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours in milliseconds
                isFrozen: false,
                freezeReason: ''
            });
        }

        // Populate the booking with all necessary data
        const populatedBooking = await Booking.findById(booking._id)
            .populate('modelDetails')
            .populate('colorDetails')
            .populate('branchDetails')
            .populate('createdByDetails')
            .populate('salesExecutiveDetails')
            .populate({ path: 'priceComponents.header', model: 'Header' })
            .populate({ path: 'accessories.accessory', model: 'Accessory' })
            .populate({ path: 'exchangeDetails.broker', model: 'Broker' })
            .populate({ path: 'payment.financer', model: 'FinanceProvider' });

        // Generate and save the booking form HTML in ALL cases
        try {
            const formResult = await generateBookingFormHTML(populatedBooking);
            populatedBooking.formPath = formResult.url;
            populatedBooking.formGenerated = true;
            await populatedBooking.save();
        } catch (pdfError) {
            console.error('Error generating booking form HTML:', pdfError);
            // Continue even if HTML generation fails
        }

        await AuditLog.create({
            action: 'CREATE',
            entity: 'Booking',
            entityId: booking._id,
            user: req.user.id,
            ip: req.ip,
            metadata: bookingData,
            status: 'SUCCESS'
        });

        res.status(201).json({
            success: true,
            data: populatedBooking
        });
    } catch (err) {
        console.error('Error creating booking:', err);
        
        let message = 'Error creating booking';
        if (err.name === 'ValidationError') {
            message = Object.values(err.errors).map(val => val.message).join(', ');
        } else if (err.message) {
            message = err.message;
        }

        await AuditLog.create({
            action: 'CREATE',
            entity: 'Booking',
            user: req.user?.id,
            ip: req.ip,
            status: 'FAILED',
            metadata: req.body,
            error: message
        }).catch(logErr => console.error('Failed to create audit log:', logErr));
        
        res.status(400).json({
            success: false,
            message,
            error: process.env.NODE_ENV === 'development' ? err.stack : undefined
        });
    }
};
/**
 * @desc    Get booking statistics and document counts
 * @route   GET /api/v1/bookings/stats
 * @access  Private (SuperAdmin sees all, others see their own)
 */
exports.getBookingStats = async (req, res) => {
  try {
    const isSuperAdmin = req.user.roles.some(r => r.isSuperAdmin);
    const isSalesExecutive = req.user.roles.some(r => r.name === 'SALES_EXECUTIVE');
    
    // Base match conditions
    const matchConditions = {};
    
    // For non-superadmins, filter by branch or sales executive
    if (!isSuperAdmin) {
      if (isSalesExecutive) {
        matchConditions.$or = [
          { createdBy: req.user.id },
          { salesExecutive: req.user.id }
        ];
      } else if (req.user.branch) {
        matchConditions.branch = req.user.branch;
      }
    }

    // Get date ranges
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - today.getDay() + 1); // Monday

    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

    // Get booking counts for different time periods
    const [todayCount, weekCount, monthCount] = await Promise.all([
      Booking.countDocuments({
        ...matchConditions,
        createdAt: { $gte: today }
      }),
      Booking.countDocuments({
        ...matchConditions,
        createdAt: { $gte: weekStart }
      }),
      Booking.countDocuments({
        ...matchConditions,
        createdAt: { $gte: monthStart }
      })
    ]);

    // Get document status counts (all time)
    const [kycPending, financeLetterPending] = await Promise.all([
      Booking.countDocuments({
        ...matchConditions,
        kycStatus: 'PENDING'
      }),
      Booking.countDocuments({
        ...matchConditions,
        financeLetterStatus: 'PENDING',
        'payment.type': 'FINANCE'
      })
    ]);

    // Get today's document status counts
    const [kycPendingToday, financeLetterPendingToday] = await Promise.all([
      Booking.countDocuments({
        ...matchConditions,
        kycStatus: 'PENDING',
        createdAt: { $gte: today }
      }),
      Booking.countDocuments({
        ...matchConditions,
        financeLetterStatus: 'PENDING',
        'payment.type': 'FINANCE',
        createdAt: { $gte: today }
      })
    ]);

    // Get weekly document status counts
    const [kycPendingThisWeek, financeLetterPendingThisWeek] = await Promise.all([
      Booking.countDocuments({
        ...matchConditions,
        kycStatus: 'PENDING',
        createdAt: { $gte: weekStart }
      }),
      Booking.countDocuments({
        ...matchConditions,
        financeLetterStatus: 'PENDING',
        'payment.type': 'FINANCE',
        createdAt: { $gte: weekStart }
      })
    ]);

    // Get monthly document status counts
    const [kycPendingThisMonth, financeLetterPendingThisMonth] = await Promise.all([
      Booking.countDocuments({
        ...matchConditions,
        kycStatus: 'PENDING',
        createdAt: { $gte: monthStart }
      }),
      Booking.countDocuments({
        ...matchConditions,
        financeLetterStatus: 'PENDING',
        'payment.type': 'FINANCE',
        createdAt: { $gte: monthStart }
      })
    ]);

    // For superadmin, get counts grouped by sales executive
    let salesExecutiveStats = [];
    if (isSuperAdmin) {
      salesExecutiveStats = await Booking.aggregate([
        {
          $match: {
            createdAt: { $gte: monthStart }
          }
        },
        {
          $group: {
            _id: '$salesExecutive',
            count: { $sum: 1 }
          }
        },
        {
          $lookup: {
            from: 'users',
            localField: '_id',
            foreignField: '_id',
            as: 'userDetails'
          }
        },
        {
          $unwind: '$userDetails'
        },
        {
          $project: {
            salesExecutiveId: '$_id',
            salesExecutiveName: '$userDetails.name',
            salesExecutiveEmail: '$userDetails.email',
            count: 1,
            _id: 0
          }
        },
        {
          $sort: { count: -1 }
        }
      ]);
    }

    res.status(200).json({
      success: true,
      data: {
        counts: {
          today: todayCount,
          thisWeek: weekCount,
          thisMonth: monthCount
        },
        pendingDocuments: {
          kyc: {
            total: kycPending,
            today: kycPendingToday,
            thisWeek: kycPendingThisWeek,
            thisMonth: kycPendingThisMonth
          },
          financeLetter: {
            total: financeLetterPending,
            today: financeLetterPendingToday,
            thisWeek: financeLetterPendingThisWeek,
            thisMonth: financeLetterPendingThisMonth
          }
        },
        salesExecutiveStats: isSuperAdmin ? salesExecutiveStats : undefined
      }
    });

  } catch (err) {
    console.error('Error getting booking stats:', err);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching booking statistics',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

/**
 * @desc    Get booking form HTML by ID
 * @route   GET /api/v1/bookings/:id/form
 * @access  Private
 */
exports.getBookingForm = async (req, res) => {
  try {
    const bookingId = req.params.id;
    
    if (!mongoose.Types.ObjectId.isValid(bookingId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid booking ID format'
      });
    }

    // Find the booking with all necessary populated data
    const booking = await Booking.findById(bookingId)
      .populate('modelDetails')
      .populate('colorDetails')
      .populate('branchDetails')
      .populate('salesExecutiveDetails')
      .populate({ 
        path: 'priceComponents.header', 
        model: 'Header' 
      })
      .populate({ 
        path: 'accessories.accessory', 
        model: 'Accessory' 
      })
      .populate({ 
        path: 'exchangeDetails.broker', 
        model: 'Broker' 
      })
      .populate({ 
        path: 'payment.financer', 
        model: 'FinanceProvider' 
      });

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    // Check if user has permission to view this booking
    const isSuperAdmin = req.user.roles.some(r => r.isSuperAdmin);
    if (!isSuperAdmin && booking.branch.toString() !== req.user.branch.toString()) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to view this booking'
      });
    }

    // Generate the HTML form
    const html = await generateBookingFormHTML(booking, false);

    // Set response headers for HTML content
    res.set('Content-Type', 'text/html');
    res.status(200).send(html);

  } catch (err) {
    console.error('Error getting booking form:', err);
    
    await AuditLog.create({
      action: 'VIEW_FORM',
      entity: 'Booking',
      entityId: req.params.id,
      user: req.user?.id,
      ip: req.ip,
      status: 'FAILED',
      error: err.message
    });

    res.status(500).json({
      success: false,
      message: 'Server error while fetching booking form',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};
// In your bookingController.js
exports.getBookingByChassisNumber = async (req, res) => {
  try {
    const { chassisNumber } = req.params;
    
    // Validate chassis number format
    if (!chassisNumber || !/^[A-Z0-9]{17}$/.test(chassisNumber)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid chassis number format - must be exactly 17 alphanumeric characters'
      });
    }

    // Find booking by chassis number (case insensitive)
    const booking = await Booking.findOne({ 
      chassisNumber: chassisNumber.toUpperCase() 
    })
      .populate('model')
      .populate('color')
      .populate('branch')
      .populate('createdBy', 'name email')
      .populate('salesExecutive', 'name email')
      .populate({
        path: 'priceComponents.header',
        model: 'Header'
      })
      .populate({
        path: 'accessories.accessory',
        model: 'Accessory',
        populate: {
          path: 'category',
          model: 'AccessoryCategory'
        }
      })
      .populate({
        path: 'exchangeDetails.broker',
        model: 'Broker'
      })
      .populate({
        path: 'payment.financer',
        model: 'FinanceProvider'
      })
      .populate('approvedBy', 'name email');

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found for this chassis number'
      });
    }

    // Check if user has permission to view this booking
    const isSuperAdmin = req.user.roles.some(r => r.isSuperAdmin);
    if (!isSuperAdmin && booking.branch.toString() !== req.user.branch.toString()) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to view this booking'
      });
    }

    // Transform the response to include accessory categories
    const transformedBooking = booking.toObject();
    
    // Process accessories to include category details
    if (transformedBooking.accessories && transformedBooking.accessories.length > 0) {
      transformedBooking.accessories = transformedBooking.accessories.map(accessory => {
        if (accessory.accessory && accessory.accessory.category) {
          return {
            ...accessory,
            categoryDetails: accessory.accessory.category
          };
        }
        return accessory;
      });
    }

    res.status(200).json({
      success: true,
      data: transformedBooking
    });

  } catch (err) {
    console.error('Error getting booking by chassis number:', err);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching booking',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};
/**
 * @desc    Approve booking (simple version - just updates status)
 * @route   PUT /api/v1/bookings/:id/approve
 * @access  Private (Admin/Manager)
 */
exports.approveBooking = async (req, res) => {
  try {
    // 1. Validate booking ID format
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid booking ID format' 
      });
    }

    // 2. Check user permissions
    const isSuperAdmin = req.user.roles.some(r => r.isSuperAdmin);
    const isManagerOrAdmin = req.user.roles.some(r => 
      ['MANAGER', 'ADMIN'].includes(r.name)
    );

    if (!isSuperAdmin && !isManagerOrAdmin) {
      return res.status(403).json({ 
        success: false, 
        message: 'Unauthorized to approve bookings' 
      });
    }

    // 3. Find and update the booking (no status condition)
    const booking = await Booking.findByIdAndUpdate(
      req.params.id,
      { 
        $set: { 
          status: 'APPROVED',
          approvedBy: req.user.id,
          approvedAt: new Date(),
          // Also approve any pending discounts if they exist
          "discounts.$[].approvedBy": req.user.id,
          "discounts.$[].approvalStatus": 'APPROVED',
          "discounts.$[].approvalNote": req.body.approvalNote || 'Approved'
        }
      },
      { 
        new: true,
        runValidators: true 
      }
    )
      .populate("model", "model_name type")
      .populate("color", "name code")
      .populate("branch", "name address")
      .populate("approvedBy", "name email mobile");

    if (!booking) {
      return res.status(404).json({ 
        success: false, 
        message: 'Booking not found' 
      });
    }

    // 4. (Optional) Generate booking form if needed
    if (process.env.GENERATE_FORMS === 'true') {
      generateBookingFormHTML(booking)
        .then(formResult => {
          booking.formPath = formResult.url;
          booking.formGenerated = true;
          return booking.save();
        })
        .catch(err => {
          console.error("Error generating booking form:", err);
        });
    }

    // 5. Create audit log
    await AuditLog.create({
      action: "APPROVE",
      entity: "Booking",
      entityId: booking._id,
      user: req.user.id,
      ip: req.ip,
      metadata: {
        approvalNote: req.body.approvalNote || 'No note provided'
      },
      status: "SUCCESS"
    });

    // 6. Return success response
    res.status(200).json({
      success: true,
      data: booking,
      message: 'Booking approved successfully'
    });

  } catch (err) {
    console.error("Error approving booking:", err);
    
    await AuditLog.create({
      action: "APPROVE",
      entity: "Booking",
      entityId: req.params.id,
      user: req.user.id,
      ip: req.ip,
      metadata: {
        error: err.message
      },
      status: "FAILED"
    });

    res.status(500).json({
      success: false,
      message: "Error approving booking",
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};
// Get booking by ID with all populated details (fixed version)
exports.getBookingById = async (req, res) => {
  try {
    const bookingId = req.params.id;
    
    if (!mongoose.Types.ObjectId.isValid(bookingId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid booking ID format'
      });
    }

    // Find the booking with all necessary populated data
    const booking = await Booking.findById(bookingId)
      .populate('model', 'model_name type')
      .populate('color', 'name code')
      .populate('branch', 'name')
      .populate('createdBy', 'name email')
      .populate('salesExecutive', 'name email')
      .populate({
        path: 'priceComponents.header',
        model: 'Header'
      })
      .populate({
        path: 'accessories.accessory',
        model: 'Accessory'
      })
      .populate({
        path: 'exchangeDetails.broker',
        model: 'Broker'
      })
      .populate({
        path: 'payment.financer',
        model: 'FinanceProvider'
      })
      .populate('approvedBy', 'name email');

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    // Check if user has BOOKING:READ permission
    if (!req.user || !req.user.hasPermission('BOOKING', 'READ')) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to view this booking'
      });
    }

    // Convert to plain object and transform the response
    const bookingObj = booking.toObject();
    
    // Ensure model name is included in the response
    if (bookingObj.model) {
      bookingObj.model.name = bookingObj.model.model_name;
      // Optionally keep both names or just one
      // delete bookingObj.model.model_name; 
    }

    res.status(200).json({
      success: true,
      data: bookingObj
    });

  } catch (err) {
    console.error('Error getting booking:', err);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching booking',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};
// Update getAllBookings
exports.getAllBookings = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 100, 
      status, 
      branch, 
      fromDate, 
      toDate,
      customerType,
      model,
      kycStatus,
      financeLetterStatus
    } = req.query;
    
    // Build filter object
    const filter = {};
    
    // Status filter
    if (status) {
      filter.status = status;
    }
    
    // Customer type filter
    if (customerType) {
      filter.customerType = customerType;
    }
    
    // Model filter
    if (model) {
      filter.model = model;
    }
    
    // Date range filter
    if (fromDate || toDate) {
      filter.createdAt = {};
      if (fromDate) filter.createdAt.$gte = new Date(fromDate);
      if (toDate) filter.createdAt.$lte = new Date(toDate);
    }

    // Check user role and permissions
    const isSuperAdmin = req.user.roles.some(r => r.isSuperAdmin);
    const isSalesExecutive = req.user.roles.some(r => r.name === 'SALES_EXECUTIVE');

    // Branch filter logic
    if (!isSuperAdmin) {
      if (isSalesExecutive) {
        // Sales Executive can only see their own bookings
        filter.$or = [
          { createdBy: req.user.id },
          { salesExecutive: req.user.id }
        ];
      } else {
        // Other users can see all bookings from their branch
        filter.branch = req.user.branch;
      }
    } else if (branch) {
      // SuperAdmin can filter by branch if specified
      filter.branch = branch;
    }

    // Add KYC and Finance Letter status filters if provided
    const docFilters = {};
    if (kycStatus) {
      docFilters['documentStatus.kyc.status'] = kycStatus;
    }
    if (financeLetterStatus) {
      docFilters['documentStatus.financeLetter.status'] = financeLetterStatus;
    }
    
    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      sort: { createdAt: -1 }, // Newest first
      populate: [
        'model',
        { path: 'color', select: 'name code' },
        'branch',
        {
          path: 'createdBy',
          select: 'name email'
        },
        {
          path: 'salesExecutive',
          select: 'name email'
        },
        {
          path: 'exchangeDetails.broker',
          select: 'name mobile'
        },
        {
          path: 'payment.financer',
          select: 'name'
        }
      ],
      lean: true
    };
    
    // First get the paginated bookings
    let bookings = await Booking.paginate(filter, options);
    
    // Get KYC and Finance Letter details for each booking
    const bookingsWithDocStatus = await Promise.all(
      bookings.docs.map(async (booking) => {
        const [kyc, financeLetter] = await Promise.all([
          mongoose.model('KYC').findOne({ booking: booking._id })
            .select('status verifiedBy verificationNote updatedAt')
            .populate('verifiedBy', 'name')
            .lean(),
          mongoose.model('FinanceLetter').findOne({ booking: booking._id })
            .select('status verifiedBy verificationNote updatedAt')
            .populate('verifiedBy', 'name')
            .lean()
        ]);
        
        // Create simplified status objects
        const kycStatus = kyc ? {
          status: kyc.status,
          verifiedBy: kyc.verifiedBy?.name || null,
          verificationNote: kyc.verificationNote || null,
          updatedAt: kyc.updatedAt
        } : {
          status: 'NOT_UPLOADED',
          verifiedBy: null,
          verificationNote: null,
          updatedAt: null
        };

        const financeLetterStatus = financeLetter ? {
          status: financeLetter.status,
          verifiedBy: financeLetter.verifiedBy?.name || null,
          verificationNote: financeLetter.verificationNote || null,
          updatedAt: financeLetter.updatedAt
        } : {
          status: 'NOT_UPLOADED',
          verifiedBy: null,
          verificationNote: null,
          updatedAt: null
        };

        // Apply additional filtering if KYC or Finance Letter status filters were provided
        let includeBooking = true;
        if (kycStatus && docFilters['documentStatus.kyc.status'] && kycStatus.status !== docFilters['documentStatus.kyc.status']) {
          includeBooking = false;
        }
        if (financeLetterStatus && docFilters['documentStatus.financeLetter.status'] && financeLetterStatus.status !== docFilters['documentStatus.financeLetter.status']) {
          includeBooking = false;
        }

        return includeBooking ? {
          ...booking,
          documentStatus: {
            kyc: kycStatus,
            financeLetter: financeLetterStatus
          }
        } : null;
      })
    );

    // Filter out null bookings (excluded by document status filters)
    const filteredBookings = bookingsWithDocStatus.filter(booking => booking !== null);
    
    // Adjust pagination counts
    const adjustedTotal = filteredBookings.length === bookings.docs.length ? 
      bookings.totalDocs : 
      await Booking.countDocuments({ ...filter, ...docFilters });
    
    const adjustedPages = Math.ceil(adjustedTotal / parseInt(limit));
    
    res.status(200).json({
      success: true,
      data: {
        bookings: filteredBookings,
        total: adjustedTotal,
        pages: adjustedPages,
        currentPage: parseInt(page)
      }
    });
    
  } catch (err) {
    console.error('Error getting bookings:', err);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching bookings',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};
// exports.getBookingById = async (req, res) => {
//   try {
//     const bookingId = req.params.id;
    
//     if (!mongoose.Types.ObjectId.isValid(bookingId)) {
//       return res.status(400).json({
//         success: false,
//         message: 'Invalid booking ID format'
//       });
//     }

//     // Find the booking with all necessary populated data
//     const booking = await Booking.findById(bookingId)
//       .populate('model', 'model_name type') // Ensure model_name is populated
//       .populate('color', 'name code')
//       .populate('branch', 'name')
//       .populate('createdBy', 'name email')
//       .populate('salesExecutive', 'name email')
//       .populate({
//         path: 'priceComponents.header',
//         model: 'Header'
//       })
//       .populate({
//         path: 'accessories.accessory',
//         model: 'Accessory'
//       })
//       .populate({
//         path: 'exchangeDetails.broker',
//         model: 'Broker'
//       })
//       .populate({
//         path: 'payment.financer',
//         model: 'FinanceProvider'
//       })
//       .populate('approvedBy', 'name email');

//     if (!booking) {
//       return res.status(404).json({
//         success: false,
//         message: 'Booking not found'
//       });
//     }

//     // Check if user has permission to view this booking
//     const isSuperAdmin = req.user.roles.some(r => r.isSuperAdmin);
//     if (!isSuperAdmin && booking.branch.toString() !== req.user.branch.toString()) {
//       return res.status(403).json({
//         success: false,
//         message: 'You are not authorized to view this booking'
//       });
//     }

//     // Convert to plain object and transform the response
//     const bookingObj = booking.toObject();
    
//     // Ensure model name is included in the response
//     if (bookingObj.model) {
//       bookingObj.model.name = bookingObj.model.model_name;
//       delete bookingObj.model.model_name; // Optional: clean up the field name
//     }

//     res.status(200).json({
//       success: true,
//       data: bookingObj
//     });

//   } catch (err) {
//     console.error('Error getting booking:', err);
//     res.status(500).json({
//       success: false,
//       message: 'Server error while fetching booking',
//       error: process.env.NODE_ENV === 'development' ? err.message : undefined
//     });
//   }
// };
exports.updateBooking = async (req, res) => {
    try {
        // Validate booking ID
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid booking ID format'
            });
        }

        // Find the existing booking
        const existingBooking = await Booking.findById(req.params.id)
            .populate('modelDetails')
            .populate('colorDetails')
            .populate('branchDetails')
            .populate({ path: 'priceComponents.header', model: 'Header' });

        if (!existingBooking) {
            return res.status(404).json({
                success: false,
                message: 'Booking not found'
            });
        }

        // Check user permissions
        const isSuperAdmin = req.user.roles.some(r => r.isSuperAdmin);
        const isBookingOwner = existingBooking.createdBy.equals(req.user._id);
        const isSalesExecutive = existingBooking.salesExecutive.equals(req.user._id);
        
        if (!isSuperAdmin && !isBookingOwner && !isSalesExecutive) {
            return res.status(403).json({
                success: false,
                message: 'You are not authorized to update this booking'
            });
        }

        // Check if booking can be modified
        if (['APPROVED', 'COMPLETED', 'CANCELLED'].includes(existingBooking.status)) {
            return res.status(400).json({
                success: false,
                message: 'Booking cannot be modified in its current status'
            });
        }

        // Initialize update object with existing values
        const updateData = {
            ...existingBooking.toObject(),
            updatedAt: new Date()
        };

        // Helper function to update nested objects
        const updateNestedObject = (target, source, fields) => {
            fields.forEach(field => {
                if (source[field] !== undefined) {
                    target[field] = source[field];
                }
            });
        };

        // Update basic fields if provided
        if (req.body.model_id) {
            const model = await Model.findById(req.body.model_id);
            if (!model) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid model selected'
                });
            }
            updateData.model = req.body.model_id;
        }

        if (req.body.model_color) {
            const color = await Color.findById(req.body.model_color);
            if (!color) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid color selected'
                });
            }
            updateData.color = req.body.model_color;
        }

        if (req.body.customer_type) {
            if (!['B2B', 'B2C', 'CSD'].includes(req.body.customer_type)) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid customer type. Must be B2B, B2C, or CSD'
                });
            }
            updateData.customerType = req.body.customer_type;
            updateData.isCSD = req.body.customer_type === 'CSD';
        }

        if (req.body.rto_type) {
            if (!['MH', 'BH', 'CRTM'].includes(req.body.rto_type)) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid RTO type. Must be MH, BH, or CRTM'
                });
            }
            updateData.rto = req.body.rto_type;
            
            if (['BH', 'CRTM'].includes(req.body.rto_type)) {
                if (req.body.rto_amount) {
                    updateData.rtoAmount = req.body.rto_amount;
                } else {
                    const rtoHeader = await Header.findOne({
                        header_key: 'RTO CHARGES'
                    });
                    
                    if (rtoHeader) {
                        const model = updateData.model || existingBooking.model;
                        const modelDoc = await Model.findById(model);
                        if (modelDoc) {
                            const rtoPrice = modelDoc.prices.find(
                                p => p.header_id.equals(rtoHeader._id) && 
                                     p.branch_id.equals(existingBooking.branch)
                            );
                            if (rtoPrice) {
                                updateData.rtoAmount = rtoPrice.value;
                            }
                        }
                    }
                }
            } else {
                updateData.rtoAmount = undefined;
            }
        }

        if (req.body.gstin !== undefined) {
            if (updateData.customerType === 'B2B' && !req.body.gstin) {
                return res.status(400).json({
                    success: false,
                    message: 'GSTIN is required for B2B customers'
                });
            }
            updateData.gstin = req.body.gstin || '';
        }

        if (req.body.hpa !== undefined) {
            updateData.hpa = req.body.hpa;
            
            if (req.body.hpa) {
                const hpaHeader = await Header.findOne({
                    header_key: 'HYPOTHECATION CHARGES (IF APPLICABLE)'
                });
                
                if (hpaHeader) {
                    const model = updateData.model || existingBooking.model;
                    const modelDoc = await Model.findById(model);
                    if (modelDoc) {
                        const hpaPrice = modelDoc.prices.find(
                            p => p.header_id.equals(hpaHeader._id) && 
                                 p.branch_id.equals(existingBooking.branch)
                        );
                        if (hpaPrice) {
                            updateData.hypothecationCharges = hpaPrice.value;
                        }
                    }
                }
            } else {
                updateData.hypothecationCharges = 0;
            }
        }

        // Update customer details if provided
        if (req.body.customer_details) {
            const customerDetails = { ...existingBooking.customerDetails };
            
            if (req.body.customer_details.salutation) {
                const validSalutations = ['Mr.', 'Mrs.', 'Miss', 'Dr.', 'Prof.'];
                if (!validSalutations.includes(req.body.customer_details.salutation)) {
                    return res.status(400).json({
                        success: false,
                        message: 'Valid salutation (Mr., Mrs., Miss, Dr., Prof.) is required'
                    });
                }
                customerDetails.salutation = req.body.customer_details.salutation;
            }
            
            updateNestedObject(customerDetails, req.body.customer_details, [
                'name', 'panNo', 'dob', 'occupation', 'address', 'taluka', 
                'district', 'pincode', 'mobile1', 'mobile2', 'aadharNumber',
                'nomineeName', 'nomineeRelation', 'nomineeAge'
            ]);
            
            if (req.body.customer_details.mobile1) {
                if (!/^[6-9]\d{9}$/.test(req.body.customer_details.mobile1)) {
                    return res.status(400).json({
                        success: false,
                        message: 'Invalid primary mobile number'
                    });
                }
            }
            
            if (req.body.customer_details.mobile2 && req.body.customer_details.mobile2 !== '') {
                if (!/^[6-9]\d{9}$/.test(req.body.customer_details.mobile2)) {
                    return res.status(400).json({
                        success: false,
                        message: 'Invalid secondary mobile number'
                    });
                }
            }
            
            if (req.body.customer_details.pincode) {
                if (!/^[1-9][0-9]{5}$/.test(req.body.customer_details.pincode)) {
                    return res.status(400).json({
                        success: false,
                        message: 'Invalid pincode'
                    });
                }
            }
            
            updateData.customerDetails = customerDetails;
        }

        // Update exchange details if provided
        if (req.body.exchange !== undefined) {
            if (req.body.exchange.is_exchange) {
                if (!req.body.exchange.broker_id) {
                    return res.status(400).json({
                        success: false,
                        message: 'Broker selection is required for exchange'
                    });
                }

                const broker = await Broker.findById(req.body.exchange.broker_id);
                if (!broker) {
                    return res.status(400).json({
                        success: false,
                        message: 'Invalid broker selected'
                    });
                }

                if (!broker.branches.some(b => b.branch.equals(existingBooking.branch))) {
                    return res.status(400).json({
                        success: false,
                        message: 'Broker not available for this branch'
                    });
                }

                updateData.exchange = true;
                updateData.exchangeDetails = {
                    broker: req.body.exchange.broker_id,
                    price: req.body.exchange.exchange_price,
                    vehicleNumber: req.body.exchange.vehicle_number,
                    chassisNumber: req.body.exchange.chassis_number
                };
            } else {
                updateData.exchange = false;
                updateData.exchangeDetails = undefined;
            }
        }

        // Update payment details if provided
        if (req.body.payment !== undefined) {
            if (req.body.payment.type.toLowerCase() === 'finance') {
                if (!req.body.payment.financer_id) {
                    return res.status(400).json({
                        success: false,
                        message: 'Financer selection is required'
                    });
                }

                const financer = await FinanceProvider.findById(req.body.payment.financer_id);
                if (!financer) {
                    return res.status(400).json({
                        success: false,
                        message: 'Invalid financer selected'
                    });
                }

                let gcAmount = 0;
                if (req.body.payment.gc_applicable) {
                    const financerRate = await FinancerRate.findOne({
                        financeProvider: req.body.payment.financer_id,
                        branch: existingBooking.branch,
                        is_active: true
                    });

                    if (!financerRate) {
                        return res.status(400).json({
                            success: false,
                            message: 'Financer rate not found for this branch'
                        });
                    }

                    const baseAmount = updateData.priceComponents?.reduce((sum, c) => sum + c.originalValue, 0) || 
                                      existingBooking.priceComponents.reduce((sum, c) => sum + c.originalValue, 0);
                    
                    gcAmount = (baseAmount * financerRate.gcRate) / 100;
                }

                updateData.payment = {
                    type: 'FINANCE',
                    financer: req.body.payment.financer_id,
                    scheme: req.body.payment.scheme || null,
                    emiPlan: req.body.payment.emi_plan || null,
                    gcApplicable: req.body.payment.gc_applicable,
                    gcAmount: gcAmount
                };
            } else {
                updateData.payment = {
                    type: 'CASH'
                };
            }
        }

        // Update accessories if provided
        if (req.body.accessories !== undefined) {
            let accessoriesTotal = 0;
            let accessories = [];

            if (req.body.accessories.selected?.length > 0) {
                const accessoryIds = req.body.accessories.selected.map(acc => {
                    if (!mongoose.Types.ObjectId.isValid(acc.id)) {
                        throw new Error(`Invalid accessory ID: ${acc.id}`);
                    }
                    return new mongoose.Types.ObjectId(acc.id);
                });

                const validAccessories = await Accessory.find({
                    _id: { $in: accessoryIds },
                    status: 'active'
                });

                if (validAccessories.length !== req.body.accessories.selected.length) {
                    const missingIds = req.body.accessories.selected
                        .filter(a => !validAccessories.some(v => v._id.toString() === a.id))
                        .map(a => a.id);
                    return res.status(400).json({
                        success: false,
                        message: `Invalid accessory IDs: ${missingIds.join(', ')}`
                    });
                }

                const model = updateData.model || existingBooking.model;
                const incompatibleAccessories = validAccessories.filter(
                    a => !a.applicable_models.some(m => m.toString() === model.toString())
                );
                if (incompatibleAccessories.length > 0) {
                    return res.status(400).json({
                        success: false,
                        message: `Incompatible accessories: ${
                            incompatibleAccessories.map(a => a.name).join(', ')
                        }`
                    });
                }

                const accessoriesTotalHeader = await Header.findOne({
                    header_key: 'ACCESSORIES TOTAL',
                    type: existingBooking.modelDetails.type
                });
                
                if (!accessoriesTotalHeader) {
                    return res.status(400).json({
                        success: false,
                        message: 'ACCESSORIES TOTAL header not configured'
                    });
                }

                const modelDoc = await Model.findById(model);
                const accessoriesTotalPrice = modelDoc.prices.find(
                    p => p.header_id.equals(accessoriesTotalHeader._id) && 
                         p.branch_id.equals(existingBooking.branch)
                )?.value || 0;

                const selectedAccessoriesTotal = validAccessories.reduce(
                    (sum, acc) => sum + acc.price, 
                    0
                );

                accessoriesTotal = Math.max(selectedAccessoriesTotal, accessoriesTotalPrice);
                
                accessories = validAccessories.map(acc => ({
                    accessory: acc._id,
                    price: acc.price,
                    discount: 0
                }));

                if (selectedAccessoriesTotal < accessoriesTotalPrice) {
                    const difference = accessoriesTotalPrice - selectedAccessoriesTotal;
                    accessories.push({
                        accessory: null, 
                        price: difference,
                        discount: 0
                    });
                }
            }

            updateData.accessories = accessories;
            updateData.accessoriesTotal = accessoriesTotal;
        }

        // Update price components if provided
        if (req.body.price_components !== undefined) {
            const model = updateData.model || existingBooking.model;
            const modelDoc = await Model.findById(model);
            const headers = await Header.find({ type: modelDoc.type });

            const priceComponents = await Promise.all(headers.map(async (header) => {
                const priceData = modelDoc.prices.find(
                    p => p.header_id.equals(header._id) && p.branch_id.equals(existingBooking.branch)
                );

                if (!priceData) return null;

                const updatedComponent = req.body.price_components.find(
                    pc => pc.header_id && pc.header_id.toString() === header._id.toString()
                );

                if (!updatedComponent) {
                    const existingComponent = existingBooking.priceComponents.find(
                        pc => pc.header && pc.header.toString() === header._id.toString()
                    );
                    return existingComponent || null;
                }

                if (header.header_key === 'HYPOTHECATION CHARGES (IF APPLICABLE)') {
                    return {
                        header: header._id,
                        originalValue: priceData.value,
                        discountedValue: updateData.hpa ? priceData.value : 0,
                        isDiscountable: false,
                        isMandatory: false,
                        metadata: priceData.metadata || {}
                    };
                }

                if (header.is_mandatory) {
                    return {
                        header: header._id,
                        originalValue: priceData.value,
                        discountedValue: updatedComponent.discounted_value || priceData.value,
                        isDiscountable: header.is_discount,
                        isMandatory: true,
                        metadata: priceData.metadata || {}
                    };
                }

                return {
                    header: header._id,
                    originalValue: priceData.value,
                    discountedValue: updatedComponent.discounted_value || priceData.value,
                    isDiscountable: header.is_discount,
                    isMandatory: false,
                    metadata: priceData.metadata || {}
                };
            }));

            updateData.priceComponents = priceComponents.filter(c => c !== null);
        }

        // Update discounts if provided
        if (req.body.discounts !== undefined) {
            let discounts = [];
            let totalDiscount = 0;

            if (Array.isArray(req.body.discounts)) {
                for (const discount of req.body.discounts) {
                    if (!discount.amount || !discount.type) continue;

                    discounts.push({
                        amount: discount.amount,
                        type: discount.type.toUpperCase() === 'PERCENTAGE' ? 'PERCENTAGE' : 'FIXED',
                        approvedBy: discount.approved ? req.user._id : undefined,
                        approvalStatus: discount.approved ? 'APPROVED' : 'PENDING',
                        approvalNote: discount.note || '',
                        appliedOn: new Date()
                    });
                }
            }

            if (discounts.length > 0) {
                const priceComponents = updateData.priceComponents || existingBooking.priceComponents;
                let updatedComponents = [...priceComponents];
                
                for (const discount of discounts) {
                    updatedComponents = calculateDiscounts(updatedComponents, discount.amount, discount.type);
                    validateDiscountLimits(updatedComponents);
                }

                totalDiscount = priceComponents.reduce((sum, component) => {
                    const updated = updatedComponents.find(
                        uc => uc.header?.toString() === component.header?.toString()
                    );
                    return sum + (component.originalValue - (updated?.discountedValue || component.discountedValue));
                }, 0);

                updateData.priceComponents = updatedComponents;
            }

            updateData.discounts = discounts;
            
            const baseAmount = (updateData.priceComponents || existingBooking.priceComponents)
                .reduce((sum, c) => sum + c.originalValue, 0);
            
            updateData.totalAmount = baseAmount + (updateData.accessoriesTotal || existingBooking.accessoriesTotal) + 
                                  (updateData.rtoAmount || existingBooking.rtoAmount || 0);
            
            updateData.discountedAmount = updateData.totalAmount - totalDiscount;
        }

        // Update sales executive if provided
        if (req.body.sales_executive !== undefined) {
            if (req.body.sales_executive) {
                const salesExecutive = await User.findById(req.body.sales_executive)
                    .populate('roles');
                
                if (!salesExecutive ||  salesExecutive.status !== 'ACTIVE') {
                    return res.status(400).json({
                        success: false,
                        message: 'Invalid or inactive sales executive selected'
                    });
                }

                const isSalesExecutive = salesExecutive.roles.some(r => 
                    r.name === 'SALES_EXECUTIVE'
                );
                
                if (!isSalesExecutive) {
                    return res.status(400).json({
                        success: false,
                        message: 'Selected user must have SALES_EXECUTIVE role'
                    });
                }

                if (!salesExecutive.branch || 
                    salesExecutive.branch.toString() !== existingBooking.branch.toString()) {
                    return res.status(400).json({
                        success: false,
                        message: 'Sales executive must belong to the booking branch'
                    });
                }

                updateData.salesExecutive = req.body.sales_executive;
            } else {
                updateData.salesExecutive = existingBooking.createdBy;
            }
        }

        // Update status if provided
        if (req.body.status !== undefined) {
            const validStatuses = [
                'DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 
                'COMPLETED', 'CANCELLED', 'KYC_PENDING', 'KYC_VERIFIED',
                'PENDING_APPROVAL (Discount_Exceeded)'
            ];
            
            if (!validStatuses.includes(req.body.status)) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid status provided'
                });
            }

            const allowedStatusUpdates = {
                SALES_EXECUTIVE: ['DRAFT', 'PENDING_APPROVAL'],
                MANAGER: ['APPROVED', 'REJECTED', 'KYC_PENDING', 'KYC_VERIFIED'],
                ADMIN: ['COMPLETED', 'CANCELLED']
            };

            const userRoles = req.user.roles.map(r => r.name);
            let canUpdateStatus = false;

            for (const [role, statuses] of Object.entries(allowedStatusUpdates)) {
                if (userRoles.includes(role) && statuses.includes(req.body.status)) {
                    canUpdateStatus = true;
                    break;
                }
            }

            if (!canUpdateStatus && !isSuperAdmin) {
                return res.status(403).json({
                    success: false,
                    message: 'You are not authorized to update status to this value'
                });
            }

            updateData.status = req.body.status;
            
            if (req.body.status === 'APPROVED') {
                updateData.approvedBy = req.user._id;
            }
        }

        // Update the booking
        // const  = await Booking.findByIdAndUpdate(
        //     req.params.id,
        //     { $set: updateData },
        //     { new: true }
        // )
        // .populate('modelDetails')
        // .populate('colorDetails')
        // .populate('branchDetails')
        // .populate('createdByDetails')
        // .populate('salesExecutiveDetails')
        // .populate({ path: 'priceComponents.header', model: 'Header' })
        // .populate({ path: 'accessories.accessory', model: 'Accessory' })
        // .populate({ path: 'exchangeDetails.broker', model: 'Broker' })
        // .populate({ path: 'payment.financer', model: 'FinanceProvider' });
        const updatedBooking = await Booking.findByIdAndUpdate(
            req.params.id,
            { $set: updateData },
            { new: true }
        )
        .populate('modelDetails')
        .populate('colorDetails')
        .populate('branchDetails')
        .populate('createdByDetails')
        .populate('salesExecutiveDetails')
        .populate({ path: 'priceComponents.header', model: 'Header' })
        .populate({ path: 'accessories.accessory', model: 'Accessory' })
        .populate({ path: 'exchangeDetails.broker', model: 'Broker' })
        .populate({ path: 'payment.financer', model: 'FinanceProvider' });

        // Regenerate the booking form HTML after update
        try {
            const formResult = await generateBookingFormHTML(updatedBooking);
            updatedBooking.formPath = formResult.url;
            updatedBooking.formGenerated = true;
            await updatedBooking.save();
        } catch (pdfError) {
            console.error('Error regenerating booking form after update:', pdfError);
            // Continue even if HTML generation fails
        }

        await AuditLog.create({
            action: 'UPDATE',
            entity: 'Booking',
            entityId: updatedBooking._id,
            user: req.user._id,
            ip: req.ip,
            metadata: {
                oldData: existingBooking.toObject(),
                newData: updatedBooking.toObject(),
                updatedFields: Object.keys(req.body)
            },
            status: 'SUCCESS'
        });

        res.status(200).json({
            success: true,
            data: updatedBooking
        });
    } catch (err) {
        console.error('Error updating booking:', err);
        
        let message = 'Error updating booking';
        if (err.name === 'ValidationError') {
            message = Object.values(err.errors).map(val => val.message).join(', ');
        } else if (err.message) {
            message = err.message;
        }

        await AuditLog.create({
            action: 'UPDATE',
            entity: 'Booking',
            entityId: req.params.id,
            user: req.user?._id,
            ip: req.ip,
            status: 'FAILED',
            metadata: req.body,
            error: message
        }).catch(logErr => console.error('Failed to create audit log:', logErr));
        
        res.status(400).json({
            success: false,
            message,
            error: process.env.NODE_ENV === 'development' ? err.stack : undefined
        });
    }
};
// exports.approveBooking = async (req, res) => {
//     try {
//         // 1. Validate booking ID
//         if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
//             return res.status(400).json({ 
//                 success: false, 
//                 message: 'Invalid booking ID format' 
//             });
//         }

//         // 2. Validate chassis number if provided
//         if (req.body.chassisNumber && !/^[A-Za-z0-9]{17}$/.test(req.body.chassisNumber)) {
//             return res.status(400).json({
//                 success: false,
//                 message: 'Invalid chassis number format (must be 17 alphanumeric characters)'
//             });
//         }

//         // 3. Check user permissions
//         const isSuperAdmin = req.user.roles.some(r => r.isSuperAdmin);
//         const isManagerOrAdmin = req.user.roles.some(r => 
//             ['MANAGER', 'ADMIN', 'SUPERADMIN'].includes(r.name)
//         );
        
//         if (!isSuperAdmin && !isManagerOrAdmin) {
//             return res.status(403).json({ 
//                 success: false, 
//                 message: 'Unauthorized to approve bookings' 
//             });
//         }

//         // 4. Prepare update data
//         const updateData = { 
//             status: 'APPROVED',
//             approvedBy: req.user.id,
//             'discounts.$[].approvedBy': req.user.id,
//             'discounts.$[].approvalStatus': 'APPROVED',
//             'discounts.$[].approvalNote': req.body.approvalNote || ''
//         };

//         // 5. Add chassis number to update if provided
//         if (req.body.chassisNumber) {
//             updateData.chassisNumber = req.body.chassisNumber;
//         }

//         // 6. Find and update the booking
//         const booking = await Booking.findOneAndUpdate(
//             { 
//                 _id: req.params.id,
//                 status: 'PENDING_APPROVAL'
//             },
//             { $set: updateData },
//             { 
//                 new: true,
//                 populate: [
//                     { path: 'modelDetails', select: 'model_name type' },
//                     { path: 'colorDetails', select: 'name code' },
//                     { path: 'branchDetails', select: 'name address' },
//                     { path: 'approvedByDetails', select: 'name email' }
//                 ]
//             }
//         );

//         if (!booking) {
//             return res.status(404).json({ 
//                 success: false, 
//                 message: 'Booking not found or not pending approval' 
//             });
//         }

//         // 7. Generate and save the booking form PDF after approval
//         try {
//             const formResult = await generateBookingFormHTML(booking);
//             booking.formPath = formResult.url;
//             booking.formGenerated = true;
//             await booking.save();
//         } catch (pdfError) {
//             console.error('Error generating booking form PDF after approval:', pdfError);
//             // Continue even if PDF generation fails
//         }

//         // 8. Create audit log (non-blocking)
//         AuditLog.create({
//             action: 'APPROVE',
//             entity: 'Booking',
//             entityId: booking._id,
//             user: req.user.id,
//             ip: req.ip,
//             metadata: { 
//                 approvalNote: req.body.approvalNote,
//                 chassisNumber: req.body.chassisNumber || null
//             },
//             status: 'SUCCESS'
//         }).catch(err => console.error('Audit log error:', err));

//         res.status(200).json({
//             success: true,
//             data: booking
//         });
//     } catch (err) {
//         console.error('Error approving booking:', err);
//         res.status(500).json({
//             success: false,
//             message: 'Error approving booking',
//             error: process.env.NODE_ENV === 'development' ? err.message : undefined
//         });
//     }
// };
exports.rejectBooking = async (req, res) => {
  try {
    // Find booking
    const booking = await Booking.findById(req.params.id);
    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    // Check if booking needs approval
    if (booking.status !== 'PENDING_APPROVAL') {
      return res.status(400).json({
        success: false,
        message: 'Booking does not require approval'
      });
    }

    // Check if user has approval permissions
    const canApprove = req.user.roles.some(role => 
      role.permissions.some(p => 
        p.module === 'BOOKING' && p.action === 'APPROVE'
      )
    );

    if (!canApprove) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized to reject bookings'
      });
    }

    // Update booking status
    booking.status = 'REJECTED';
    booking.approvedBy = req.user.id;
    
    // Update discount approval status
    booking.discounts = booking.discounts.map(d => ({
      ...d.toObject(),
      approvedBy: req.user.id,
      approvalStatus: 'REJECTED',
      approvalNote: req.body.rejectionNote
    }));

    await booking.save();

    await booking.populate([
      'modelDetails',
      'colorDetails',
      'rtoDetails',
      'branchDetails',
      'createdByDetails',
      'approvedByDetails'
    ]);

    await AuditLog.create({
      action: 'REJECT',
      entity: 'Booking',
      entityId: booking._id,
      user: req.user.id,
      ip: req.ip,
      metadata: {
        rejectionNote: req.body.rejectionNote
      },
      status: 'SUCCESS'
    });

    res.status(200).json({
      success: true,
      data: booking
    });
  } catch (err) {
    console.error('Error rejecting booking:', err);
    
    await AuditLog.create({
      action: 'REJECT',
      entity: 'Booking',
      entityId: req.params.id,
      user: req.user?.id,
      ip: req.ip,
      status: 'FAILED',
      error: err.message
    });

    res.status(500).json({
      success: false,
      message: 'Error rejecting booking',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};
exports.completeBooking = async (req, res) => {
  try {
    // Find booking
    const booking = await Booking.findById(req.params.id);
    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    // Check if booking can be completed
    if (booking.status !== 'APPROVED') {
      return res.status(400).json({
        success: false,
        message: 'Only APPROVED bookings can be completed'
      });
    }

    // Check if user has complete permissions
    const canComplete = req.user.roles.some(role => 
      role.permissions.some(p => 
        p.module === 'BOOKING' && p.action === 'COMPLETE'
      )
    );

    if (!canComplete) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized to complete bookings'
      });
    }

    // Update booking status
    booking.status = 'COMPLETED';
    await booking.save();

    await booking.populate([
      'modelDetails',
      'colorDetails',
      'rtoDetails',
      'branchDetails',
      'createdByDetails',
      'approvedByDetails'
    ]);

    await AuditLog.create({
      action: 'COMPLETE',
      entity: 'Booking',
      entityId: booking._id,
      user: req.user.id,
      ip: req.ip,
      status: 'SUCCESS'
    });

    res.status(200).json({
      success: true,
      data: booking
    });
  } catch (err) {
    console.error('Error completing booking:', err);
    
    await AuditLog.create({
      action: 'COMPLETE',
      entity: 'Booking',
      entityId: req.params.id,
      user: req.user?.id,
      ip: req.ip,
      status: 'FAILED',
      error: err.message
    });

    res.status(500).json({
      success: false,
      message: 'Error completing booking',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};
exports.cancelBooking = async (req, res) => {
  try {
    // Find booking
    const booking = await Booking.findById(req.params.id);
    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    // Check if booking can be cancelled
    if (booking.status === 'COMPLETED' || booking.status === 'CANCELLED') {
      return res.status(400).json({
        success: false,
        message: 'Booking cannot be cancelled in its current state'
      });
    }

    // Check if user has cancel permissions
    const canCancel = req.user.roles.some(role => 
      role.permissions.some(p => 
        p.module === 'BOOKING' && (p.action === 'CANCEL' || p.action === 'ALL')
      )
    );

    if (!canCancel) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized to cancel bookings'
      });
    }

    // Update booking status
    booking.status = 'CANCELLED';
    await booking.save();

    await booking.populate([
      'modelDetails',
      'colorDetails',
      'rtoDetails',
      'branchDetails',
      'createdByDetails',
      'approvedByDetails'
    ]);

    await AuditLog.create({
      action: 'CANCEL',
      entity: 'Booking',
      entityId: booking._id,
      user: req.user.id,
      ip: req.ip,
      metadata: {
        cancellationReason: req.body.cancellationReason
      },
      status: 'SUCCESS'
    });

    res.status(200).json({
      success: true,
      data: booking
    });
  } catch (err) {
    console.error('Error cancelling booking:', err);
    
    await AuditLog.create({
      action: 'CANCEL',
      entity: 'Booking',
      entityId: req.params.id,
      user: req.user?.id,
      ip: req.ip,
      status: 'FAILED',
      error: err.message
    });

    res.status(500).json({
      success: false,
      message: 'Error cancelling booking',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};
exports.getBookingWithDocuments = async (req, res) => {
  try {
    const bookingId = req.params.id;
    
    if (!mongoose.Types.ObjectId.isValid(bookingId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid booking ID format'
      });
    }

    const booking = await Booking.findById(bookingId)
      .populate('model')
      .populate('color')
      .populate('branch')
      .populate('createdBy', 'name email')
      .populate('salesExecutive', 'name email')
      .populate('approvedBy', 'name email');

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    // Check permissions
    const isSuperAdmin = req.user.roles.some(r => r.isSuperAdmin);
    if (!isSuperAdmin && booking.branch.toString() !== req.user.branch.toString()) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to view this booking'
      });
    }

    // Get KYC and Finance Letter status
    const [kyc, financeLetter] = await Promise.all([
      KYC.findOne({ booking: bookingId })
        .select('status verificationNote verifiedBy verificationDate')
        .populate('verifiedBy', 'name'),
      FinanceLetter.findOne({ booking: bookingId })
        .select('status verificationNote verifiedBy verificationDate')
        .populate('verifiedBy', 'name')
    ]);

    const response = {
      ...booking.toObject(),
      kycStatus: booking.kycStatus,
      kycDetails: kyc ? {
        status: kyc.status,
        verificationNote: kyc.verificationNote,
        verifiedBy: kyc.verifiedBy?.name,
        verificationDate: kyc.verificationDate
      } : null,
      financeLetterStatus: booking.financeLetterStatus,
      financeLetterDetails: financeLetter ? {
        status: financeLetter.status,
        verificationNote: financeLetter.verificationNote,
        verifiedBy: financeLetter.verifiedBy?.name,
        verificationDate: financeLetter.verificationDate
      } : null
    };

    res.status(200).json({
      success: true,
      data: response
    });

  } catch (err) {
    console.error('Error getting booking with documents:', err);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching booking',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};
// Check if Booking is Ready for Delivery
exports.checkReadyForDelivery = async (req, res) => {
  try {
    const bookingId = req.params.id;
    
    if (!mongoose.Types.ObjectId.isValid(bookingId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid booking ID format'
      });
    }

    const booking = await Booking.findById(bookingId);
    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    // Check permissions
    const isSuperAdmin = req.user.roles.some(r => r.isSuperAdmin);
    if (!isSuperAdmin && booking.branch.toString() !== req.user.branch.toString()) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to view this booking'
      });
    }

    // Check if all requirements are met
    const requirements = {
      bookingApproved: booking.status === 'APPROVED',
      kycApproved: booking.kycStatus === 'APPROVED',
      financeLetterApproved: booking.payment.type === 'FINANCE' ? 
        booking.financeLetterStatus === 'APPROVED' : true
    };

    const isReady = Object.values(requirements).every(val => val === true);
    const missingRequirements = Object.entries(requirements)
      .filter(([_, val]) => !val)
      .map(([key]) => key.replace(/([A-Z])/g, ' $1').toLowerCase());

    res.status(200).json({
      success: true,
      data: {
        isReady,
        requirements,
        missingRequirements: isReady ? [] : missingRequirements
      }
    });

  } catch (err) {
    console.error('Error checking delivery readiness:', err);
    res.status(500).json({
      success: false,
      message: 'Server error while checking delivery readiness',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};
exports.getUpdateForm = async (req, res) => {
  try {
    const bookingId = req.params.id;
    
    if (!mongoose.Types.ObjectId.isValid(bookingId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid booking ID format'
      });
    }

    // Find the booking with all necessary populated data
    const booking = await Booking.findById(bookingId)
      .populate('modelDetails')
      .populate('colorDetails')
      .populate('branchDetails')
      .populate('salesExecutiveDetails');

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    // Get the model with its colors populated
    const model = await Model.findById(booking.model)
      .populate('colors'); // This ensures colors are fully populated

    if (!model) {
      return res.status(404).json({
        success: false,
        message: 'Model not found'
      });
    }

    // Prepare data for the template
    const formData = {
      booking: {
        ...booking.toObject(),
        modelDetails: booking.modelDetails,
        colorDetails: booking.colorDetails,
        _id: booking._id
      },
      modelDetails: {
        ...model.toObject(),
        colors: model.colors // This should now be an array of color objects
      }
    };

    // Load the update form template
    const templatePath = path.join(__dirname, '../templates/updateFormTemplate.html');
    const templateHtml = fs.readFileSync(templatePath, 'utf8');
    const updateFormTemplate = Handlebars.compile(templateHtml);

    // Generate HTML content
    const html = updateFormTemplate(formData);

    // Set response headers for HTML content
    res.set('Content-Type', 'text/html');
    res.status(200).send(html);

  } catch (err) {
    console.error('Error getting update form:', err);
    
    await AuditLog.create({
      action: 'VIEW_UPDATE_FORM',
      entity: 'Booking',
      entityId: req.params.id,
      user: req.user?.id,
      ip: req.ip,
      status: 'FAILED',
      error: err.message
    });

    res.status(500).json({
      success: false,
      message: 'Server error while fetching update form',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

exports.getFullyPaidPendingRTOBookings = async (req, res) => {
  try {
    const bookings = await Booking.find({
      balanceAmount: 0,
      rtoStatus: 'pending'
    }).lean().populate({
        path: "model",
        select: "model_name type",
      });

    res.status(200).json({ success: true, count: bookings.length, data: bookings });
  } catch (error) {
    console.error('Error fetching fully paid & pending RTO bookings:', error);
    res.status(500).json({ success: false, message: 'Server Error', error: error.message });
  }
};

/**
 * @desc    Allocate chassis number to booking
 * @route   PUT /api/v1/bookings/:id/allocate
 * @access  Private (Admin/Manager)
 */
exports.allocateChassisNumber = async (req, res) => {
  try {
    // Validate booking ID
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid booking ID format' 
      });
    }

    // Validate chassis number format
    if (!req.body.chassisNumber || !/^[A-Z0-9]{17}$/.test(req.body.chassisNumber)) {
      return res.status(400).json({
        success: false,
        message: 'Chassis number must be exactly 17 alphanumeric characters'
      });
    }

    // Check user permissions
    const isSuperAdmin = req.user.roles.some(r => r.isSuperAdmin);
    const isManagerOrAdmin = req.user.roles.some(r => 
      ['MANAGER', 'ADMIN'].includes(r.name)
    );

    if (!isSuperAdmin && !isManagerOrAdmin) {
      return res.status(403).json({ 
        success: false, 
        message: 'Unauthorized to allocate chassis numbers' 
      });
    }

    // Check for duplicate chassis number
    const existingBooking = await Booking.findOne({ 
      chassisNumber: req.body.chassisNumber.toUpperCase(),
      _id: { $ne: req.params.id }
    });

    if (existingBooking) {
      return res.status(400).json({
        success: false,
        message: 'Chassis number already assigned to another booking'
      });
    }

    // Find and update the booking
    const booking = await Booking.findOneAndUpdate(
      { 
        _id: req.params.id,
        status: { $in: ['PENDING_APPROVAL', 'APPROVED'] } // Only allow allocation for these statuses
      },
      { 
        $set: { 
          chassisNumber: req.body.chassisNumber.toUpperCase(),
          status: 'ALLOCATED'
        }
      },
      { new: true }
    ).populate('model color branch createdBy salesExecutive');

    if (!booking) {
      return res.status(404).json({ 
        success: false, 
        message: 'Booking not found or not in a valid status for allocation' 
      });
    }

    // Create audit log
    await AuditLog.create({
      action: 'ALLOCATE_CHASSIS',
      entity: 'Booking',
      entityId: booking._id,
      user: req.user.id,
      ip: req.ip,
      metadata: {
        chassisNumber: req.body.chassisNumber
      },
      status: 'SUCCESS'
    });

    res.status(200).json({
      success: true,
      data: booking,
      message: 'Chassis number allocated successfully'
    });

  } catch (err) {
    console.error('Error allocating chassis number:', err);
    
    await AuditLog.create({
      action: 'ALLOCATE_CHASSIS',
      entity: 'Booking',
      entityId: req.params.id,
      user: req.user?.id,
      ip: req.ip,
      status: 'FAILED',
      error: err.message
    });

    res.status(500).json({
      success: false,
      message: 'Error allocating chassis number',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

exports.getBookingsByInsuranceStatus = async (req, res, next) => {
  try {
    const { status } = req.params;

    const allowedStatuses = ['AWAITING', 'COMPLETED', 'LATER'];
    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid insuranceStatus. Allowed: ${allowedStatuses.join(', ')}`
      });
    }

    const options = {
      populate: [
        { path: 'modelDetails' },
        { path: 'colorDetails' },
        { path: 'branchDetails' },
        { path: 'createdByDetails' },
        { path: 'salesExecutiveDetails' }
      ],
      sort: { createdAt: -1 },
      lean: true
    };

    const query = {
      insuranceStatus: status,
      chassisNumber: { $exists: true, $ne: '' } // ensure chassisNumber exists and is not empty
    };

    const bookings = await Booking.paginate(query, options);

    res.status(200).json({
      success: true,
      count: bookings.docs.length,
      data: bookings
    });
  } catch (error) {
    console.error('Error fetching bookings by insuranceStatus:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};


