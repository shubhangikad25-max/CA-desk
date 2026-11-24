const DataStore = require('../models/dataStore');

async function getInvoices(req, res) {
    try {
        const { clientId, status } = req.query;
        const invoices = DataStore.invoices.list({ clientId, status });
        return res.json({
            success: true,
            count: invoices.length,
            data: invoices
        });
    } catch (err) {
        return res.status(500).json({ success: false, message: 'Failed to fetch invoices' });
    }
}

async function getInvoiceById(req, res) {
    try {
        const { id } = req.params;
        const invoice = DataStore.invoices.getById(id);
        if (!invoice) {
            return res.status(404).json({ success: false, message: 'Invoice not found' });
        }
        return res.json({ success: true, data: invoice });
    } catch (err) {
        return res.status(500).json({ success: false, message: 'Failed to fetch invoice' });
    }
}

async function createInvoice(req, res) {
    try {
        const {
            clientId,
            issueDate,
            dueDate,
            items,
            notes
        } = req.body;

        if (!clientId) {
            return res.status(400).json({ success: false, message: 'Client ID is required' });
        }

        const client = DataStore.clients.getById(clientId);
        if (!client) {
            return res.status(404).json({ success: false, message: 'Client not found' });
        }

        if (!items || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ success: false, message: 'At least one line item is required' });
        }

        // Calculate line items and GST safely
        let subtotal = 0;
        const processedItems = items.map(item => {
            const amt = Math.max(0, Number(item.amount) || 0);
            const rate = Number(item.taxRate) || 18; // Standard CA service SAC 9982 GST rate is 18%
            const taxAmt = Math.round((amt * rate) / 100);
            const total = amt + taxAmt;
            subtotal += amt;
            return {
                description: item.description || 'Professional CA Advisory Services',
                hsnSac: item.hsnSac || '998231',
                amount: amt,
                taxRate: rate,
                taxAmount: taxAmt,
                total
            };
        });

        const isInterState = client.address && !client.address.toLowerCase().includes('mumbai') && !client.address.toLowerCase().includes('maharashtra');
        let cgst = 0;
        let sgst = 0;
        let igst = 0;

        if (isInterState) {
            igst = Math.round((subtotal * 18) / 100);
        } else {
            cgst = Math.round((subtotal * 9) / 100);
            sgst = Math.round((subtotal * 9) / 100);
        }

        const totalAmount = subtotal + cgst + sgst + igst;

        const newInvoice = DataStore.invoices.create({
            clientId,
            clientName: client.name,
            clientPan: client.pan,
            clientAddress: client.address,
            issueDate: issueDate || new Date().toISOString().substring(0, 10),
            dueDate: dueDate || new Date(Date.now() + 15 * 86400000).toISOString().substring(0, 10),
            items: processedItems,
            subtotal,
            cgst,
            sgst,
            igst,
            totalAmount,
            notes: notes || '',
            firmDetails: {
                name: 'Sharma & Associates, Chartered Accountants',
                gstin: '27AABCS1429K1Z5',
                pan: 'AABCS1429K',
                address: 'Corporate Suites 401, Nariman Point, Mumbai - 400021'
            }
        });

        DataStore.auditLogs.log(req.user.id, req.user.name, 'INVOICE_CREATED', 'Invoice', newInvoice.id, {
            invoiceNumber: newInvoice.invoiceNumber,
            totalAmount: newInvoice.totalAmount
        });

        return res.status(201).json({
            success: true,
            message: 'Invoice created successfully',
            data: newInvoice
        });
    } catch (err) {
        console.error('createInvoice error:', err);
        return res.status(500).json({ success: false, message: 'Failed to create invoice' });
    }
}

async function recordPayment(req, res) {
    try {
        const { id } = req.params;
        const { amount, mode, referenceNo, date } = req.body;

        const numAmount = Number(amount);
        if (!Number.isFinite(numAmount) || numAmount <= 0) {
            return res.status(400).json({ success: false, message: 'Valid payment amount is required' });
        }

        const inv = DataStore.invoices.getById(id);
        if (!inv) {
            return res.status(404).json({ success: false, message: 'Invoice not found' });
        }

        if (numAmount > inv.balanceDue) {
            return res.status(400).json({
                success: false,
                message: `Payment amount (₹${numAmount.toLocaleString('en-IN')}) cannot exceed outstanding balance (₹${inv.balanceDue.toLocaleString('en-IN')})`
            });
        }

        const updatedInv = DataStore.invoices.recordPayment(id, {
            amount: numAmount,
            mode: mode || 'Bank Transfer / NEFT',
            referenceNo: referenceNo || 'REF-' + Date.now(),
            date: date || new Date().toISOString().substring(0, 10),
            recordedBy: req.user ? req.user.name : 'Authorized Staff'
        });

        DataStore.auditLogs.log(req.user.id, req.user.name, 'PAYMENT_RECORDED', 'Invoice', id, {
            amount: numAmount,
            mode,
            balanceRemaining: updatedInv.balanceDue
        });

        return res.json({
            success: true,
            message: `Payment of ₹${numAmount.toLocaleString('en-IN')} recorded successfully. New balance: ₹${updatedInv.balanceDue.toLocaleString('en-IN')}`,
            data: updatedInv
        });
    } catch (err) {
        return res.status(500).json({ success: false, message: 'Failed to record payment' });
    }
}

module.exports = {
    getInvoices,
    getInvoiceById,
    createInvoice,
    recordPayment
};
