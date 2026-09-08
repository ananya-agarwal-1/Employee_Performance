CREATE DATABASE WorkManagementSystem;
USE WorkManagementSystem;

-- =====================================================
-- 1. USER TABLE
-- =====================================================

CREATE TABLE User (
    user_id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    role ENUM('employee', 'manager', 'senior') NOT NULL
);

INSERT INTO User (name, email, password, role) VALUES
('Rahul Sharma', 'rahul.manager@company.com', 'manager123', 'manager'),
('Priya Mehta', 'priya.manager@company.com', 'manager456', 'manager'),
('Amit Kumar', 'amit.employee@company.com', 'employee123', 'employee'),
('Neha Singh', 'neha.employee@company.com', 'employee456', 'employee'),
('Rohan Verma', 'rohan.employee@company.com', 'employee789', 'employee'),
('Anjali Gupta', 'anjali.senior@company.com', 'senior123', 'senior'),
('Vikram Patel', 'vikram.senior@company.com', 'senior456', 'senior');


-- =====================================================
-- 2. WORK ASSIGNMENT TABLE
-- =====================================================

CREATE TABLE WorkAssignment (
    work_id INT AUTO_INCREMENT PRIMARY KEY,
    manager_id INT NOT NULL,
    employee_id INT NOT NULL,
    title VARCHAR(150) NOT NULL,
    description TEXT,
    assigned_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    due_date DATE,
    status ENUM(
        'assigned',
        'in_progress',
        'submitted',
        'approved',
        'rejected'
    ) DEFAULT 'assigned',
    rejection_reason TEXT,
    credit_awarded BOOLEAN DEFAULT FALSE,

    FOREIGN KEY (manager_id) REFERENCES User(user_id),
    FOREIGN KEY (employee_id) REFERENCES User(user_id)
);

INSERT INTO WorkAssignment
(manager_id, employee_id, title, description,
 assigned_date, due_date, status, rejection_reason, credit_awarded)
VALUES

(1, 3,
 'Develop Login Module',
 'Create login page with email, password and role-based authentication.',
 '2026-09-01 09:00:00',
 '2026-09-15',
 'in_progress',
 NULL,
 FALSE),

(1, 4,
 'Prepare Project Documentation',
 'Prepare complete technical documentation of the project.',
 '2026-09-02 10:30:00',
 '2026-09-12',
 'assigned',
 NULL,
 FALSE),

(2, 5,
 'Database Design',
 'Design and implement database tables and relationships.',
 '2026-09-01 11:00:00',
 '2026-09-10',
 'submitted',
 NULL,
 FALSE),

(2, 3,
 'Testing Module',
 'Perform functional and integration testing of the application.',
 '2026-09-03 14:00:00',
 '2026-09-17',
 'approved',
 NULL,
 TRUE),

(1, 5,
 'UI Development',
 'Develop the frontend interface for the employee dashboard.',
 '2026-09-04 09:30:00',
 '2026-09-20',
 'rejected',
 'Dashboard did not meet the required design specifications.',
 FALSE);


-- =====================================================
-- 3. WORK UPDATE TABLE
-- =====================================================

CREATE TABLE WorkUpdate (
    update_id INT AUTO_INCREMENT PRIMARY KEY,
    work_id INT NOT NULL,
    update_text TEXT NOT NULL,
    update_date DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (work_id) REFERENCES WorkAssignment(work_id)
);

INSERT INTO WorkUpdate
(work_id, update_text, update_date)
VALUES

(1,
 'Login page has been created and database connection has been completed.',
 '2026-09-03 15:30:00'),

(1,
 'Password validation and role-based authentication are being implemented.',
 '2026-09-05 17:00:00'),

(2,
 'Project documentation structure has been prepared.',
 '2026-09-04 12:00:00'),

(3,
 'Database tables and relationships have been created.',
 '2026-09-06 16:30:00'),

(3,
 'Foreign key constraints and sample data have been added.',
 '2026-09-07 18:00:00'),

(4,
 'All major modules have been tested successfully.',
 '2026-09-08 13:00:00'),

(5,
 'Initial dashboard design has been completed.',
 '2026-09-06 15:00:00');


-- =====================================================
-- 4. APPEAL TABLE
-- =====================================================

CREATE TABLE Appeal (
    appeal_id INT AUTO_INCREMENT PRIMARY KEY,
    work_id INT NOT NULL,
    employee_id INT NOT NULL,
    appeal_reason TEXT NOT NULL,
    appeal_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    status ENUM(
        'pending',
        'accepted',
        'rejected'
    ) DEFAULT 'pending',
    senior_id INT,
    decision_reason TEXT,
    decision_date DATETIME,

    FOREIGN KEY (work_id) REFERENCES WorkAssignment(work_id),
    FOREIGN KEY (employee_id) REFERENCES User(user_id),
    FOREIGN KEY (senior_id) REFERENCES User(user_id)
);

INSERT INTO Appeal
(work_id, employee_id, appeal_reason,
 appeal_date, status, senior_id, decision_reason, decision_date)
VALUES

(5,
 5,
 'The dashboard design was based on the earlier requirements. I have corrected the design and request another review.',
 '2026-09-07 19:00:00',
 'pending',
 NULL,
 NULL,
 NULL),

(3,
 5,
 'The database design has been corrected according to the feedback provided by the manager.',
 '2026-09-08 10:00:00',
 'accepted',
 6,
 'The revised database design satisfies all the required specifications.',
 '2026-09-08 15:00:00');


-- =====================================================
-- 5. AUDIT LOG TABLE
-- =====================================================

CREATE TABLE AuditLog (
    log_id INT AUTO_INCREMENT PRIMARY KEY,
    work_id INT,
    action_type VARCHAR(50) NOT NULL,
    performed_by INT,
    action_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    details TEXT,

    FOREIGN KEY (work_id) REFERENCES WorkAssignment(work_id),
    FOREIGN KEY (performed_by) REFERENCES User(user_id)
);

INSERT INTO AuditLog
(work_id, action_type, performed_by, action_date, details)
VALUES

(1,
 'WORK_ASSIGNED',
 1,
 '2026-09-01 09:00:00',
 'Manager Rahul Sharma assigned Login Module to Amit Kumar.'),

(1,
 'WORK_UPDATE',
 3,
 '2026-09-03 15:30:00',
 'Amit Kumar submitted a progress update.'),

(2,
 'WORK_ASSIGNED',
 1,
 '2026-09-02 10:30:00',
 'Manager Rahul Sharma assigned Project Documentation to Neha Singh.'),

(3,
 'WORK_ASSIGNED',
 2,
 '2026-09-01 11:00:00',
 'Manager Priya Mehta assigned Database Design to Rohan Verma.'),

(3,
 'WORK_SUBMITTED',
 5,
 '2026-09-07 18:00:00',
 'Rohan Verma submitted Database Design for approval.'),

(4,
 'WORK_APPROVED',
 2,
 '2026-09-08 14:00:00',
 'Manager Priya Mehta approved the Testing Module and awarded credit.'),

(5,
 'WORK_REJECTED',
 1,
 '2026-09-07 17:00:00',
 'Manager Rahul Sharma rejected the UI Development work.'),

(5,
 'APPEAL_CREATED',
 5,
 '2026-09-07 19:00:00',
 'Rohan Verma submitted an appeal against the rejection.');