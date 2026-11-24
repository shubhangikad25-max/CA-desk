const express = require('express');
const router = express.Router();

const taxController = require('../controllers/taxController');

router.get('/health', taxController.healthCheck);
router.get('/years', taxController.getSupportedYears);
router.get('/taxpayer-types', taxController.getTaxpayerTypes);
router.get('/slabs', taxController.getTaxSlabs);
router.post('/calculate', taxController.calculateTax);
router.post('/compare', taxController.compareTaxRegimes);
router.post('/simulate', taxController.simulateTaxSaving);

module.exports = router;
