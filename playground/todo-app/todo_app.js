
const express = require('express');
const mongoose = require('mongoose');

const app = express();
const PORT = 3001;

// Parse HTML form submissions
app.use(express.urlencoded({ extended: true }));

// Connect to MongoDB
mongoose.connect('mongodb://127.0.0.1:27017/todo_db')
  .then(() => console.log('Connected to MongoDB successfully!'))
  .catch(err => console.error('MongoDB connection error:', err));

// Task schema
const TodoSchema = new mongoose.Schema({
  task: {
    type: String,
    required: true,
    trim: true
  },
  isCompleted: {
    type: Boolean,
    default: false
  }
});

const Todo = mongoose.model('Todo', TodoSchema);

// Home page: display all tasks
app.get('/', async (req, res) => {
  try {
    const tasks = await Todo.find().sort({ _id: -1 });

    const taskHTML = tasks.map(item => `
      <div class="task ${item.isCompleted ? 'completed' : ''}">
        <span>${escapeHTML(item.task)}</span>

        <div class="actions">
          <form action="/toggle/${item._id}" method="POST">
            <button class="done" type="submit">
              ${item.isCompleted ? 'Undo' : 'Done'}
            </button>
          </form>

          <form action="/delete/${item._id}" method="POST">
            <button class="delete" type="submit">Delete</button>
          </form>
        </div>
      </div>
    `).join('');

    res.send(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>My To-Do List</title>
        <style>
          * { box-sizing: border-box; }
          body {
            font-family: Arial, sans-serif;
            background: #f1f5f9;
            margin: 0;
            padding: 40px 16px;
            color: #1e293b;
          }
          .container {
            max-width: 600px;
            margin: auto;
          }
          h1 { text-align: center; }
          .add-box, .task-list {
            background: white;
            padding: 20px;
            border-radius: 12px;
            margin-bottom: 20px;
            box-shadow: 0 4px 12px #0000000d;
          }
          .add-form { display: flex; gap: 10px; }
          input {
            flex: 1;
            min-width: 0;
            padding: 12px;
            border: 1px solid #cbd5e1;
            border-radius: 6px;
            font-size: 16px;
          }
          button {
            border: 0;
            padding: 10px 14px;
            border-radius: 6px;
            cursor: pointer;
            color: white;
          }
          .add { background: #16a34a; }
          .task {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
            padding: 14px 0;
            border-bottom: 1px solid #e2e8f0;
          }
          .task:last-child { border-bottom: 0; }
          .task span { overflow-wrap: anywhere; }
          .completed span {
            text-decoration: line-through;
            color: #94a3b8;
          }
          .actions { display: flex; gap: 8px; }
          .actions form { margin: 0; }
          .done { background: #2563eb; }
          .delete { background: #dc2626; }
          .empty { text-align: center; color: #64748b; }
          @media (max-width: 450px) {
            .task { align-items: flex-start; flex-direction: column; }
          }
        </style>
      </head>
      <body>
        <main class="container">
          <h1>📝 My To-Do List</h1>

          <section class="add-box">
            <form class="add-form" action="/add" method="POST">
              <input
                type="text"
                name="task"
                placeholder="What do you need to do?"
                maxlength="200"
                required
              >
              <button class="add" type="submit">Add</button>
            </form>
          </section>

          <section class="task-list">
            ${tasks.length ? taskHTML :
              '<p class="empty">No tasks yet. Add your first task!</p>'}
          </section>
        </main>
      </body>
      </html>
    `);
  } catch (error) {
    res.status(500).send('Unable to load tasks. Check MongoDB is running.');
    console.error(error);
  }
});

// Escape user input before displaying it as HTML
function escapeHTML(value) {
  return value.replace(/[&<>"']/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[char]);
}

// Add a task
app.post('/add', async (req, res) => {
  try {
    const task = req.body.task?.trim();

    if (!task) {
      return res.status(400).send('Please enter a task.');
    }

    await Todo.create({ task });
    res.redirect('/');
  } catch (error) {
    console.error(error);
    res.status(500).send('Unable to add task.');
  }
});

// Toggle task completion
app.post('/toggle/:id', async (req, res) => {
  try {
    const item = await Todo.findById(req.params.id);

    if (!item) {
      return res.status(404).send('Task not found.');
    }

    item.isCompleted = !item.isCompleted;
    await item.save();

    res.redirect('/');
  } catch (error) {
    console.error(error);
    res.status(500).send('Unable to update task.');
  }
});

// Delete a task
app.post('/delete/:id', async (req, res) => {
  try {
    await Todo.findByIdAndDelete(req.params.id);
    res.redirect('/');
  } catch (error) {
    console.error(error);
    res.status(500).send('Unable to delete task.');
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`To-Do App running at http://localhost:${PORT}`);
});
