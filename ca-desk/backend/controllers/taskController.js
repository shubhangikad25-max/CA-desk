const DataStore = require('../models/dataStore');

async function getTasks(req, res) {
    try {
        const { clientId, status, assignedStaffId, priority } = req.query;
        const tasks = DataStore.tasks.list({ clientId, status, assignedStaffId, priority });
        return res.json({
            success: true,
            count: tasks.length,
            data: tasks
        });
    } catch (err) {
        return res.status(500).json({ success: false, message: 'Failed to fetch tasks' });
    }
}

async function getTaskById(req, res) {
    try {
        const { id } = req.params;
        const task = DataStore.tasks.getById(id);
        if (!task) {
            return res.status(404).json({ success: false, message: 'Task not found' });
        }
        return res.json({ success: true, data: task });
    } catch (err) {
        return res.status(500).json({ success: false, message: 'Failed to fetch task' });
    }
}

async function createTask(req, res) {
    try {
        const {
            title,
            description,
            clientId,
            assignedStaffId,
            assignedStaffName,
            priority,
            dueDate,
            category
        } = req.body;

        if (!title || title.trim().length === 0) {
            return res.status(400).json({ success: false, message: 'Task title is required' });
        }

        let clientName = 'General Office';
        if (clientId) {
            const client = DataStore.clients.getById(clientId);
            if (client) clientName = client.name;
        }

        const newTask = DataStore.tasks.create({
            title: title.trim(),
            description: description ? description.trim() : '',
            clientId: clientId || null,
            clientName,
            assignedStaffId: assignedStaffId || req.user.id,
            assignedStaffName: assignedStaffName || req.user.name,
            priority: priority || 'Medium',
            dueDate: dueDate || new Date(Date.now() + 7 * 86400000).toISOString().substring(0, 10),
            category: category || 'Tax Computation',
            status: 'To Do'
        });

        DataStore.auditLogs.log(req.user.id, req.user.name, 'TASK_CREATED', 'Task', newTask.id, {
            title: newTask.title,
            clientId: newTask.clientId
        });

        return res.status(201).json({
            success: true,
            message: 'Task created successfully',
            data: newTask
        });
    } catch (err) {
        console.error('createTask error:', err);
        return res.status(500).json({ success: false, message: 'Failed to create task' });
    }
}

async function updateTask(req, res) {
    try {
        const { id } = req.params;
        const updates = req.body;

        const updated = DataStore.tasks.update(id, updates);
        if (!updated) {
            return res.status(404).json({ success: false, message: 'Task not found' });
        }

        DataStore.auditLogs.log(req.user.id, req.user.name, 'TASK_UPDATED', 'Task', id, updates);

        return res.json({
            success: true,
            message: 'Task updated successfully',
            data: updated
        });
    } catch (err) {
        return res.status(500).json({ success: false, message: 'Failed to update task' });
    }
}

async function deleteTask(req, res) {
    try {
        const { id } = req.params;
        const success = DataStore.tasks.delete(id);
        if (!success) {
            return res.status(404).json({ success: false, message: 'Task not found' });
        }

        DataStore.auditLogs.log(req.user.id, req.user.name, 'TASK_DELETED', 'Task', id);

        return res.json({
            success: true,
            message: 'Task deleted successfully'
        });
    } catch (err) {
        return res.status(500).json({ success: false, message: 'Failed to delete task' });
    }
}

module.exports = {
    getTasks,
    getTaskById,
    createTask,
    updateTask,
    deleteTask
};
