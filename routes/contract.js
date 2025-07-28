const express = require('express');
const { verifyToken } = require('../middleware/VerifyToken');
const { createSignedContract, getAllSignedContracts, getSignedContractById,
    updateSignedContract, deleteSignedContract
} = require('../controllers/contract');
const router = express.Router();


// Create a new signed contract
router.post('/', verifyToken, createSignedContract);

// Get all signed contracts
router.get('/', verifyToken, getAllSignedContracts);

// Get a single signed contract
router.get('/:id', verifyToken, getSignedContractById);

// Update a signed contract
router.put('/:id', verifyToken, updateSignedContract);

// Delete a signed contract
router.delete('/:id', verifyToken, deleteSignedContract);

module.exports = router;