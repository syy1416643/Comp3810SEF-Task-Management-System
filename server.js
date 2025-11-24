const express = require('express');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const { MongoClient, ObjectId } = require("mongodb");
const bcrypt = require('bcryptjs');
const path = require('path');

const app = express();

const MONGODB_URI = 'mongodb+srv://GP:5225766@cluster0.77iuqur.mongodb.net/?appName=Cluster0';
const PORT = 8099;
const SESSION_SECRET = process.env.SESSION_SECRET || 'comp3810sef-cloud-secret-2025';

console.log('🔧 Environment:');
console.log(' - PORT:', PORT);
console.log(' - MONGODB_URI:', MONGODB_URI ? 'Set':'Not Set');

const client = new MongoClient(MONGODB_URI);

const dbName = 'task_management_db';
const userCollection = 'users';
const taskCollection = 'tasks';

//middleware
app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Session configuration
app.use(session({
    secret: process.env.SESSION_SECRET || '3810-secret-key',
    resave: true,
    saveUninitialized: true,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        maxAge: 24 * 60 * 60 * 1000,
        httpOnly: true
    }
}));
// ==================database====================
async function initializeDatabase() {
    try {
        console.log('🔄 Connecting Database...');
        await client.connect();
        console.log('✅ MongoDB Connect Success');
        
        const db = client.db(dbName);
        
        // create index
        await db.collection(userCollection).createIndex({ username: 1 }, { unique: true });
        await db.collection(taskCollection).createIndex({ user_id: 1 });
        await db.collection(taskCollection).createIndex({ status: 1 });
        await db.collection(taskCollection).createIndex({ created_at: -1 });
        
        console.log('✅ Database Index Create Success');
        return true;
    } catch (error) {
        console.error('database Fail:', error.message);
        return false;
    }
}

async function createTestData() {
    try {
        const db = client.db(dbName);
        
        // test user
        const testUser = await db.collection(userCollection).findOne({ username: 'demo' });
        if (!testUser) {
            const hashedPassword = await bcrypt.hash('demo123', 10);
            await db.collection(userCollection).insertOne({
                username: 'demo',
                password: hashedPassword,
                email: 'demo@example.com',
                created_at: new Date()
            });
            console.log('✅ Testing User: demo/demo123');
        } else {
            console.log('✅ Testing user Exist: demo/demo123');
        }
        
        // test task
        const tasksCount = await db.collection(taskCollection).countDocuments();
        if (tasksCount === 0) {
            const sampleTasks = [
                {
                    title: 'Complet Group Project',
                    description: 'Write Report',
                    priority: 'high',
                    status: 'pending',
                    due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
                    user_id: 'demo',
                    created_at: new Date(),
                    updated_at: new Date()
                },
                {
                    title: 'Prepare Present',
                    description: 'Make PPT',
                    priority: 'medium',
                    status: 'in-progress',
                    due_date: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
                    user_id: 'demo',
                    created_at: new Date(),
                    updated_at: new Date()
                },
                {
                    title: 'Test System',
                    description: 'Test CRUD And API',
                    priority: 'low',
                    status: 'completed',
                    due_date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
                    user_id: 'demo',
                    created_at: new Date(),
                    updated_at: new Date(),
                    completed_at: new Date()
                }
            ];
            await db.collection(taskCollection).insertMany(sampleTasks);
            console.log('✅ Create Test Success');
        } else {
            console.log(`✅ Num of Task: ${tasksCount}`);
        }
    } catch (error) {
        console.error('❌ Create Data:', error.message);
    }
}

// ===================check user ====================
function requireAuth(req, res, next) {
    if (req.session && req.session.user) {
        return next();
    }
    res.redirect('/login?message=Please Login System');
}

// ==================== routes ====================
app.get('/', (req, res) => {
    res.redirect('/login');
});

app.get('/login', (req, res) => {
    if (req.session.user) {
        return res.redirect('/tasks');
    }
    res.render('login', { message: req.query.message });
});

app.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        
        if (!username || !password) {
            return res.redirect('/login?message=Fill in the username and password');
        }
        
        await client.connect();
        const db = client.db(dbName);
        const user = await db.collection(userCollection).findOne({ username });
        
        if (!user) {
            return res.redirect('/login?message=user not exist');
        }
        
        const isValid = await bcrypt.compare(password, user.password);
        if (!isValid) {
            return res.redirect('/login?message=Error pwd');
        }
        
        req.session.user = {
            _id: user._id.toString(),
            username: user.username,
            email: user.email
        };
        
        return res.redirect('/tasks');
        
    } catch (error) {
        console.error('Login Error:', error);
        return res.redirect('/login?message=Please Try Again');
    }
});

app.get('/register', (req, res) => {
    if (req.session.user) {
        return res.redirect('/tasks');
    }
    res.render('register', { message: req.query.message });
});

app.post('/register', async (req, res) => {
    try {
        const { username, password, email } = req.body;
        
        if (!username || !password || !email) {
            return res.redirect('/register?message=Fill in All info');
        }
        
        if (password.length < 6) {
            return res.redirect('/register?message=At least 6 characters');
        }
        
        await client.connect();
        const db = client.db(dbName);
        
        const existingUser = await db.collection(userCollection).findOne({ username });
        if (existingUser) {
            return res.redirect('/register?message=Username Exist');
        }
        
        const hashedPassword = await bcrypt.hash(password, 10);
        await db.collection(userCollection).insertOne({
            username,
            password: hashedPassword,
            email,
            created_at: new Date()
        });
        
        res.redirect('/login?message=Register Success');
        
    } catch (error) {
        console.error('Register Error:', error);
        res.redirect('/register?message=Please Try again');
    }
});

app.get('/tasks', requireAuth, async (req, res) => {
    try {
        const db = client.db(dbName);
        const { status, search, message } = req.query; 
        
        let query = { user_id: req.session.user.username };
        
        if (status && status !== 'all') {
            query.status = status;
        }
        
        if (search) {
            query.$or = [
                { title: { $regex: search, $options: 'i' } },
                { description: { $regex: search, $options: 'i' } }
            ];
        }
        
        const tasks = await db.collection(taskCollection)
            .find(query)
            .sort({ created_at: -1 })
            .toArray();
        
        res.render('tasks', {
            user: req.session.user,
            tasks: tasks,
            currentStatus: status || 'all',
            searchQuery: search || '',
            message: message 
        });
    } catch (error) {
        console.error('Tasks Error:', error);
        res.render('error', { 
            message: 'Cant Get Tasks', 
            user: req.session.user 
        });
    }
});
app.get('/tasks/create', requireAuth, (req, res) => {
    res.render('tasks-create', { user: req.session.user });
});

app.post('/tasks/create', requireAuth, async (req, res) => {
    try {
        const { title, description, priority, due_date } = req.body;
        
        if (!title) {
            return res.redirect('/tasks/create?message=Fill in the Task Topic');
        }
        
        const db = client.db(dbName);
        const newTask = {
            title,
            description: description || '',
            priority: priority || 'medium',
            status: 'pending',
            due_date: due_date ? new Date(due_date) : null,
            user_id: req.session.user.username,
            created_at: new Date(),
            updated_at: new Date()
        };
        
        await db.collection(taskCollection).insertOne(newTask);
        res.redirect('/tasks?message=Task Creation Success');
    } catch (error) {
        console.error('Task Creation Error:', error);
        res.redirect('/tasks/create?message=Task creation Failed');
    }
});

app.get('/tasks/edit/:id', requireAuth, async (req, res) => {
    try {
        const db = client.db(dbName);
        const task = await db.collection(taskCollection).findOne({
            _id: new ObjectId(req.params.id),
            user_id: req.session.user.username
        });
        
        if (!task) {
            return res.redirect('/tasks?message=Task Not Exist');
        }
        
        res.render('tasks-edit', {
            user: req.session.user,
            task: task
        });
    } catch (error) {
        console.error('Edit Error:', error);
        res.redirect('/tasks?message=Loading Failed');
    }
});

app.post('/tasks/update/:id', requireAuth, async (req, res) => {
    try {
        const { title, description, priority, status, due_date } = req.body;
        
        if (!title) {
            return res.redirect(`/tasks/edit/${req.params.id}?message=Fill the Task Topic`);
        }
        
        const db = client.db(dbName);
        const result = await db.collection(taskCollection).updateOne(
            {
                _id: new ObjectId(req.params.id),
                user_id: req.session.user.username
            },
            {
                $set: {
                    title,
                    description: description || '',
                    priority: priority || 'medium',
                    status: status || 'pending',
                    due_date: due_date ? new Date(due_date) : null,
                    updated_at: new Date()
                }
            }
        );
        
        if (result.modifiedCount === 0) {
            return res.redirect('/tasks?message=Update failed');
        }
        
        res.redirect('/tasks?message=Update Success');
    } catch (error) {
        console.error('Update Error:', error);
        res.redirect(`/tasks/edit/${req.params.id}?message=Update Failed`);
    }
});

app.get('/tasks/delete/:id', requireAuth, async (req, res) => {
    try {
        const db = client.db(dbName);
        const result = await db.collection(taskCollection).deleteOne({
            _id: new ObjectId(req.params.id),
            user_id: req.session.user.username
        });
        
        if (result.deletedCount === 0) {
            return res.redirect('/tasks?message=Delete Failed');
        }
        
        res.redirect('/tasks?message=Delete Success');
    } catch (error) {
        console.error('Delet Error:', error);
        res.redirect('/tasks?message=Delete failed');
    }
});

app.get('/tasks/complete/:id', requireAuth, async (req, res) => {
    try {
        const db = client.db(dbName);
        const result = await db.collection(taskCollection).updateOne(
            {
                _id: new ObjectId(req.params.id),
                user_id: req.session.user.username
            },
            {
                $set: {
                    status: 'completed',
                    updated_at: new Date(),
                    completed_at: new Date()
                }
            }
        );
        
        if (result.modifiedCount === 0) {
            return res.redirect('/tasks?message=Operation Failed');
        }
        
        res.redirect('/tasks?message=Task Complete');
    } catch (error) {
        console.error('Marking Failure:', error);
        res.redirect('/tasks?message=Operation Failed');
    }
});

app.get('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error('Logout Error:', err);
        }
        res.redirect('/login?message=Logout');
    });
});

// ==================== RESTful API ====================
app.get('/api/tasks', async (req, res) => {
    try {
        const db = client.db(dbName);
        const tasks = await db.collection(taskCollection)
            .find({})
            .sort({ created_at: -1 })
            .toArray();
        
        res.json({
            success: true,
            count: tasks.length,
            data: tasks
        });
    } catch (error) {
        console.error('API Get Task Error:', error);
        res.status(500).json({
            success: false,
            error: 'Get Task Failed'
        });
    }
});

app.get('/api/tasks/:id', async (req, res) => {
    try {
        const db = client.db(dbName);
        const task = await db.collection(taskCollection).findOne({
            _id: new ObjectId(req.params.id)
        });
        
        if (!task) {
            return res.status(404).json({
                success: false,
                error: 'Task Not Exist'
            });
        }
        
        res.json({
            success: true,
            data: task
        });
    } catch (error) {
        console.error('API get Task Error:', error);
        res.status(500).json({
            success: false,
            error: 'Get Task Error'
        });
    }
});

app.post('/api/tasks', async (req, res) => {
    try {
        const { title, description, priority, status, due_date } = req.body;
        
        if (!title) {
            return res.status(400).json({
                success: false,
                error: 'Fill in the Task Topic'
            });
        }
        
        const db = client.db(dbName);
        const newTask = {
            title,
            description: description || '',
            priority: priority || 'medium',
            status: status || 'pending',
            due_date: due_date ? new Date(due_date) : null,
            user_id: 'api-user',
            created_at: new Date(),
            updated_at: new Date()
        };
        
        const result = await db.collection(taskCollection).insertOne(newTask);
        
        res.status(201).json({
            success: true,
            message: 'Task Create Success',
            data: {
                id: result.insertedId,
                ...newTask
            }
        });
    } catch (error) {
        console.error('API Create task Error:', error);
        res.status(500).json({
            success: false,
            error: 'Creation task Failed'
        });
    }
});

app.put('/api/tasks/:id', async (req, res) => {
    try {
        const { title, description, priority, status, due_date } = req.body;
        
        const db = client.db(dbName);
        const updateData = {
            updated_at: new Date()
        };
        
        if (title) updateData.title = title;
        if (description !== undefined) updateData.description = description;
        if (priority) updateData.priority = priority;
        if (status) updateData.status = status;
        if (due_date) updateData.due_date = new Date(due_date);
        
        const result = await db.collection(taskCollection).updateOne(
            { _id: new ObjectId(req.params.id) },
            { $set: updateData }
        );
        
        if (result.modifiedCount === 0) {
            return res.status(404).json({
                success: false,
                error: 'Task Not Exist'
            });
        }
        
        res.json({
            success: true,
            message: 'Task Updated'
        });
    } catch (error) {
        console.error('API Update Error:', error);
        res.status(500).json({
            success: false,
            error: 'Update failed'
        });
    }
});

app.delete('/api/tasks/:id', async (req, res) => {
    try {
        const db = client.db(dbName);
        const result = await db.collection(taskCollection).deleteOne({
            _id: new ObjectId(req.params.id)
        });
        
        if (result.deletedCount === 0) {
            return res.status(404).json({
                success: false,
                error: 'Task Not Exist'
            });
        }
        
        res.json({
            success: true,
            message: 'Task Delet success'
        });
    } catch (error) {
        console.error('API delete Error:', error);
        res.status(500).json({
            success: false,
            error: 'Delete Error'
        });
    }
});

// ==================== Error ====================
app.use((req, res) => {
    const data = { message: `Page Not Exist: ${req.path}` };
    if (req.session && req.session.user) {
        data.user = req.session.user;
    }
    res.status(404).render('error', data);
});

app.use((error, req, res, next) => {
    console.error('Error:', error);
    const data = { message: 'Error' };
    if (req.session && req.session.user) {
        data.user = req.session.user;
    }
    res.status(500).render('error', data);
});

// ==================== server ====================
async function startServer() {
    try {
        const dbInitialized = await initializeDatabase();
        if (!dbInitialized) {
            console.log('❌ Database，Mongodb Connection Error');
            process.exit(1);
        }
        
        await createTestData();
        
        app.listen(PORT, '0.0.0.0', () => {
            console.log('\n ============================================');
            console.log(' Create Success');
            console.log(` Local Access: http://localhost:${PORT}`);
            console.log(` Cloud Access: https://comp3810sef-task-management-system.onrender.com`);
            console.log(' Test Account: demo / demo123');
            console.log(' Environment:', process.env.NODE_ENV || 'development');
            console.log('============================================\n');
        });
   } catch (error) {
        console.error('❌ Server Error:', error);
        process.exit(1);
    }
}

process.on('SIGINT', async () => {
    console.log('\n🔄 Closing Server...');
    await client.close();
    console.log('✅ Server Closed');
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('\n🔄 Closing Server...');
    await client.close();
    console.log('✅ Server Closed');
    process.exit(0);
});


startServer();
