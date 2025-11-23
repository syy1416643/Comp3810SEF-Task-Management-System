const express = require('express');
const session = require('express-session');
const formidable = require('express-formidable');
const { MongoClient, ObjectId } = require("mongodb");
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const bcrypt = require('bcryptjs');

const app = express();
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const PORT = process.env.PORT || 8099;

const client = new MongoClient(MONGODB_URI);
const dbName = 'task_management_db';
const userCollection = 'users';
const taskCollection = 'tasks';

// Middle
app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(formidable());
app.use(session({
    secret: 'comp3810sef-task-system-secret-2025',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 24 * 60 * 60 * 1000 }
}));
app.use(passport.initialize());
app.use(passport.session());

// Passport Setting
passport.use(new LocalStrategy(
    async (username, password, done) => {
        try {
            await client.connect();
            const db = client.db(dbName);
            const user = await db.collection(userCollection).findOne({ username: username });
            
            if (!user) {
                return done(null, false, { message: 'User NOT Exist' });
            }
            
            const isValidPassword = await bcrypt.compare(password, user.password);
            if (!isValidPassword) {
                return done(null, false, { message: 'Error Password' });
            }
            
            return done(null, user);
        } catch (error) {
            return done(error);
        }
    }
));

passport.serializeUser((user, done) => {
    done(null, user._id);
});

passport.deserializeUser(async (id, done) => {
    try {
        await client.connect();
        const db = client.db(dbName);
        const user = await db.collection(userCollection).findOne({ _id: new ObjectId(id) });
        done(null, user);
    } catch (error) {
        done(error);
    }
});

//check user
function isAuthenticated(req, res, next) {
    if (req.isAuthenticated()) {
        return next();
    }
    res.redirect('/login');
}

// ==================== Website ====================

// Home page
app.get('/', (req, res) => {
    res.redirect('/login');
});

// Login
app.get('/login', (req, res) => {
    res.render('login', { message: req.query.message });
});

// Login  function
app.post('/login', passport.authenticate('local', {
    successRedirect: '/tasks',
    failureRedirect: '/login?message=登入失敗，請檢查用戶名和密碼'
}));

// register
app.get('/register', (req, res) => {
    res.render('register', { message: req.query.message });
});

// Reg functiom
app.post('/register', async (req, res) => {
    try {
        await client.connect();
        const db = client.db(dbName);
        
        const { username, password, email } = req.fields;
        
        // check user name exist or not 
        const existingUser = await db.collection(userCollection).findOne({ username: username });
        if (existingUser) {
            return res.redirect('/register?message=User name already exist');
        }
        
        const hashedPassword = await bcrypt.hash(password, 10);
        
        const newUser = {
            username,
            password: hashedPassword,
            email,
            created_at: new Date()
        };
        
        await db.collection(userCollection).insertOne(newUser);
        res.redirect('/login?message=Reg success PLEASE Login');
    } catch (error) {
        console.error('Error:', error);
        res.redirect('/register?message=Please try again');
    }
});

// Task list
app.get('/tasks', isAuthenticated, async (req, res) => {
    try {
        await client.connect();
        const db = client.db(dbName);
        
        const { status, search } = req.query;
        let query = { user_id: req.user._id.toString() };
        
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
            user: req.user, 
            tasks: tasks,
            currentStatus: status || 'all',
            searchQuery: search || ''
        });
    } catch (error) {
        console.error('Task Error:', error);
        res.render('error', { message: 'Task Error', user: req.user });
    }
});

// create task page
app.get('/tasks/create', isAuthenticated, (req, res) => {
    res.render('task-create', { user: req.user });
});

// create task setting
app.post('/tasks/create', isAuthenticated, async (req, res) => {
    try {
        await client.connect();
        const db = client.db(dbName);
        
        const { title, description, priority, due_date } = req.fields;
        
        const newTask = {
            title,
            description: description || '',
            priority: priority || 'medium',
            status: 'pending',
            due_date: due_date ? new Date(due_date) : null,
            user_id: req.user._id.toString(),
            created_at: new Date(),
            updated_at: new Date()
        };
        
        await db.collection(taskCollection).insertOne(newTask);
        res.redirect('/tasks?message=Create Success');
    } catch (error) {
        console.error('Error:', error);
        res.redirect('/tasks/create?message=cant cerate task');
    }
});

// edit task
app.get('/tasks/edit/:id', isAuthenticated, async (req, res) => {
    try {
        await client.connect();
        const db = client.db(dbName);
        
        const taskId = req.params.id;
        const task = await db.collection(taskCollection).findOne({ 
            _id: new ObjectId(taskId),
            user_id: req.user._id.toString()
        });
        
        if (!task) {
            return res.redirect('/tasks?message=Task Not Exist');
        }
        
        res.render('task-edit', { 
            user: req.user, 
            task: task 
        });
    } catch (error) {
        console.error('Edit Error:', error);
        res.redirect('/tasks?message=Load Error');
    }
});

// update task
app.post('/tasks/update/:id', isAuthenticated, async (req, res) => {
    try {
        await client.connect();
        const db = client.db(dbName);
        
        const taskId = req.params.id;
        const { title, description, priority, status, due_date } = req.fields;
        
        const updateData = {
            title,
            description: description || '',
            priority: priority || 'medium',
            status: status || 'pending',
            due_date: due_date ? new Date(due_date) : null,
            updated_at: new Date()
        };
        
        const result = await db.collection(taskCollection).updateOne(
            { 
                _id: new ObjectId(taskId),
                user_id: req.user._id.toString()
            },
            { $set: updateData }
        );
        
        if (result.modifiedCount === 0) {
            return res.redirect('/tasks?message=Update Error');
        }
        
        res.redirect('/tasks?message=Update Success');
    } catch (error) {
        console.error('Error:', error);
        res.redirect(`/tasks/edit/${req.params.id}?message=Update Error`);
    }
});

// delete
app.get('/tasks/delete/:id', isAuthenticated, async (req, res) => {
    try {
        await client.connect();
        const db = client.db(dbName);
        
        const taskId = req.params.id;
        
        const result = await db.collection(taskCollection).deleteOne({
            _id: new ObjectId(taskId),
            user_id: req.user._id.toString()
        });
        
        if (result.deletedCount === 0) {
            return res.redirect('/tasks?message=Delete Error');
        }
        
        res.redirect('/tasks?message=Delete Success');
    } catch (error) {
        console.error('Delete Error:', error);
        res.redirect('/tasks?message=Cant Delete task');
    }
});

// Mark task
app.get('/tasks/complete/:id', isAuthenticated, async (req, res) => {
    try {
        await client.connect();
        const db = client.db(dbName);
        
        const taskId = req.params.id;
        
        const result = await db.collection(taskCollection).updateOne(
            { 
                _id: new ObjectId(taskId),
                user_id: req.user._id.toString()
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
            return res.redirect('/tasks?message=task Not exist or Error');
        }
        
        res.redirect('/tasks?message=Mark Done');
    } catch (error) {
        console.error('Error:', error);
        res.redirect('/tasks?message=Mark Error');
    }
});

// ==================== RESTful API ====================

// GET /api/tasks 
app.get('/api/tasks', async (req, res) => {
    try {
        await client.connect();
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
        console.error('API Error:', error);
        res.status(500).json({
            success: false,
            error: 'Fail'
        });
    }
});

// GET /api/tasks/:id 
app.get('/api/tasks/:id', async (req, res) => {
    try {
        await client.connect();
        const db = client.db(dbName);
        
        const taskId = req.params.id;
        const task = await db.collection(taskCollection).findOne({ 
            _id: new ObjectId(taskId)
        });
        
        if (!task) {
            return res.status(404).json({
                success: false,
                error: 'Not Exist'
            });
        }
        
        res.json({
            success: true,
            data: task
        });
    } catch (error) {
        console.error('API Error:', error);
        res.status(500).json({
            success: false,
            error: 'Fail'
        });
    }
});

// POST /api/tasks 
app.post('/api/tasks', async (req, res) => {
    try {
        await client.connect();
        const db = client.db(dbName);
        
        const { title, description, priority, status, due_date } = req.fields;
        
        if (!title) {
            return res.status(400).json({
                success: false,
                error: 'Topic'
            });
        }
        
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
            message: 'Success',
            data: {
                id: result.insertedId,
                ...newTask
            }
        });
    } catch (error) {
        console.error('API Error:', error);
        res.status(500).json({
            success: false,
            error: 'Fail'
        });
    }
});

// PUT /api/tasks/:id
app.put('/api/tasks/:id', async (req, res) => {
    try {
        await client.connect();
        const db = client.db(dbName);
        
        const taskId = req.params.id;
        const { title, description, priority, status, due_date } = req.fields;
        
        const updateData = {
            updated_at: new Date()
        };
        
        if (title) updateData.title = title;
        if (description !== undefined) updateData.description = description;
        if (priority) updateData.priority = priority;
        if (status) updateData.status = status;
        if (due_date) updateData.due_date = new Date(due_date);
        
        const result = await db.collection(taskCollection).updateOne(
            { _id: new ObjectId(taskId) },
            { $set: updateData }
        );
        
        if (result.modifiedCount === 0) {
            return res.status(404).json({
                success: false,
                error: '任務不存在'
            });
        }
        
        res.json({
            success: true,
            message: '任務更新成功'
        });
    } catch (error) {
        console.error('API 更新任務錯誤:', error);
        res.status(500).json({
            success: false,
            error: '更新任務失敗'
        });
    }
});

// DELETE /api/tasks/:id - 刪除任務
app.delete('/api/tasks/:id', async (req, res) => {
    try {
        await client.connect();
        const db = client.db(dbName);
        
        const taskId = req.params.id;
        
        const result = await db.collection(taskCollection).deleteOne({
            _id: new ObjectId(taskId)
        });
        
        if (result.deletedCount === 0) {
            return res.status(404).json({
                success: false,
                error: '任務不存在'
            });
        }
        
        res.json({
            success: true,
            message: '任務刪除成功'
        });
    } catch (error) {
        console.error('API 刪除任務錯誤:', error);
        res.status(500).json({
            success: false,
            error: '刪除任務失敗'
        });
    }
});

// 登出
app.get('/logout', (req, res) => {
    req.logout(() => {
        res.redirect('/login?message=已成功登出');
    });
});

// 初始化資料庫
async function initializeDatabase() {
    try {
        await client.connect();
        const db = client.db(dbName);
        
        // 建立索引
        await db.collection(userCollection).createIndex({ username: 1 }, { unique: true });
        await db.collection(taskCollection).createIndex({ user_id: 1 });
        await db.collection(taskCollection).createIndex({ status: 1 });
        await db.collection(taskCollection).createIndex({ due_date: 1 });
        
        console.log('資料庫初始化完成');
    } catch (error) {
        console.error('資料庫初始化失敗:', error);
    }
}

// 建立測試數據
async function createTestData() {
    try {
        await client.connect();
        const db = client.db(dbName);
        
        // 檢查是否已有測試用戶
        const testUser = await db.collection(userCollection).findOne({ username: 'demo' });
        if (!testUser) {
            const hashedPassword = await bcrypt.hash('demo123', 10);
            await db.collection(userCollection).insertOne({
                username: 'demo',
                password: hashedPassword,
                email: 'demo@example.com',
                created_at: new Date()
            });
            console.log('測試用戶建立完成: demo/demo123');
        }
        
        // 建立一些測試任務
        const tasksCount = await db.collection(taskCollection).countDocuments();
        if (tasksCount === 0) {
            const sampleTasks = [
                {
                    title: '完成專案報告',
                    description: '撰寫小組專案的最終報告',
                    priority: 'high',
                    status: 'pending',
                    due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
                    user_id: 'demo',
                    created_at: new Date(),
                    updated_at: new Date()
                },
                {
                    title: '準備演示文稿',
                    description: '製作5分鐘的專案演示PPT',
                    priority: 'medium',
                    status: 'in-progress',
                    due_date: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
                    user_id: 'demo',
                    created_at: new Date(),
                    updated_at: new Date()
                },
                {
                    title: '測試系統功能',
                    description: '全面測試所有CRUD操作和API',
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
            console.log('測試任務數據建立完成');
        }
    } catch (error) {
        console.error('建立測試數據錯誤:', error);
    }
}

// 啟動伺服器
app.listen(PORT, '0.0.0.0', async () => {
    console.log(`任務管理系統運行在 http://0.0.0.0:${PORT}`);
    await initializeDatabase();
    await createTestData();
    console.log('系統準備就緒！');
    console.log('測試帳號: demo / demo123');
});
