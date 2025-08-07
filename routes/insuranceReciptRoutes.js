const express = require('express');
const router = express.Router();
const insuranceController = require('../controllers/insuranceRecipt');

/**
 * @swagger
 * tags:
 *   name: Insurance-Recipt
 *   description: Insurance Recipt management APIs
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     InsuranceRecipt:
 *       type: object
 *       required:
 *         - C_Name
 *         - Chasis_No
 *         - Insurance_Date
 *         - PolicyNo
 *         - PremiumAmount
 *         - validUpto
 *         - vehicleRegNo
 *         - InsuranceCompany
 *         - MobileNO
 *       properties:
 *         C_Name:
 *           type: string
 *         Chasis_No:
 *           type: string
 *         Insurance_Date:
 *           type: string
 *           format: date
 *         PolicyNo:
 *           type: string
 *         PSAPollicyNo:
 *           type: string
 *         CMSpolicyNo:
 *           type: string
 *         PremiumAmount:
 *           type: number
 *         validUpto:
 *           type: string
 *           format: date
 *         Model:
 *           type: string
 *         vehicleRegNo:
 *           type: string
 *         InsuranceCompany:
 *           type: string
 *         MobileNO:
 *           type: string
 *         PaymentMode:
 *           type: string
 *           enum: [Cash, Online, Cheque, Other]
 *         Status:
 *           type: string
 *           enum: [Active, Expired, Pending]
 */

/**
 * @swagger
 * /api/v1/insurance-recipt:
 *   post:
 *     summary: Create a new insurance record
 *     tags: [Insurance-Recipt]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/InsuranceRecipt'
 *     responses:
 *       201:
 *         description: Insurance record created
 *       500:
 *         description: Server error
 */
router.post('/', insuranceController.createInsurance);

/**
 * @swagger
 * /api/v1/insurance-recipt:
 *   get:
 *     summary: Get all insurance records
 *     tags: [Insurance-Recipt]
 *     responses:
 *       200:
 *         description: List of insurance records
 *       500:
 *         description: Server error
 */
router.get('/', insuranceController.getAllInsurance);

/**
 * @swagger
 * /api/v1/insurance-recipt/{id}:
 *   get:
 *     summary: Get insurance record by ID
 *     tags: [Insurance-Recipt]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: Insurance record ID
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Insurance record found
 *       404:
 *         description: Record not found
 *       500:
 *         description: Server error
 */
router.get('/:id', insuranceController.getInsuranceById);

/**
 * @swagger
 * /api/v1/insurance-recipt/{id}:
 *   put:
 *     summary: Update insurance record by ID
 *     tags: [Insurance-Recipt]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: Insurance record ID
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/InsuranceRecipt'
 *     responses:
 *       200:
 *         description: Insurance record updated
 *       404:
 *         description: Record not found
 *       500:
 *         description: Server error
 */
router.put('/:id', insuranceController.updateInsurance);

/**
 * @swagger
 * /api/v1/insurance-recipt/{id}:
 *   delete:
 *     summary: Delete insurance record by ID
 *     tags: [Insurance-Recipt]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: Insurance record ID
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Insurance record deleted
 *       404:
 *         description: Record not found
 *       500:
 *         description: Server error
 */
router.delete('/:id', insuranceController.deleteInsurance);

module.exports = router;
