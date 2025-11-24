# COMP3810SEF - Task Management System

## Group Information
Group: Group 17
Course: COMP3810SEF
Group Members:
Name: [Sze Yan Yu] | Student ID: [14166430]
Name: [Ng Tsz Hin] | Student ID: [14172320]

## 2. Project File Introduction

### server.js
Main server file providing the following functionalities:
- User authentication (Login/Logout/Registration)
- Task CRUD web operations
- RESTful API endpoints
- Session management
- MongoDB database connection

### package.json
Project dependencies configuration:
- **dependencies**: 
  - express: Web framework
  - ejs: Template engine
  - mongodb: Database driver
  - express-session: Session management
  - bcryptjs: Password encryption
  - connect-mongo: Session storage
- **devDependencies**:
  - nodemon: Development hot reload

### views/ (EJS Template Files)
- **login.ejs**: User login page
- **register.ejs**: User registration page  
- **tasks.ejs**: Task list and filtering page
- **create.ejs**: Create new task form
- **edit.ejs**: Edit task form
- **error.ejs**: Error display page

## 3. Cloud-based Server URL
**Testing URL**: https://comp3810sef-task-management-system.onrender.com

## 4. Operation Guides

### Use of Login/Logout Pages
**Test Account**:
- Username: `demo`
- Password: `demo123`

**Sign-in Steps**:
1. Visit homepage, automatically redirected to login page
2. Enter username and password
3. Click "Login" button
4. Successfully redirected to task list page
5. Click "Logout" button to exit system

### Use of CRUD Web Pages
- **Create**: Click "Add Task" button, fill form and submit
- **Read**: Main page displays all tasks, supports title/description search and status filtering
- **Update**: Click "Edit" button next to task, modify and save
- **Delete**: Click "Delete" button, confirm to delete task

### Use of RESTful CRUD Services
**API Endpoints List**:

| HTTP Method | Path | Description |
|-------------|------|-------------|
| GET | `/api/tasks` | Get all tasks |
| GET | `/api/tasks/:id` | Get specific task |
| POST | `/api/tasks` | Create new task |
| PUT | `/api/tasks/:id` | Update task |
| DELETE | `/api/tasks/:id` | Delete task |

**CURL Testing Commands**:

```bash
# 1. Get all tasks
curl -X GET "https://comp3810sef-task-management-system.onrender.com/api/tasks"

# 2. Create new task
curl -X POST "https://comp3810sef-task-management-system.onrender.com/api/tasks" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "API Test Task",
    "description": "Created via REST API",
    "priority": "high",
    "status": "pending"
  }'

# 3. Update task (replace :id with actual task ID)
curl -X PUT "https://comp3810sef-task-management-system.onrender.com/api/tasks/TASK_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Updated Title",
    "status": "completed"
  }'

# 4. Delete task (replace :id with actual task ID)
curl -X DELETE "comp3810sef-task-management-system.onrender.com/api/tasks/TASK_ID"
