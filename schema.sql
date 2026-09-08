CREATE TABLE User (
    user_id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    role ENUM('employee', 'manager', 'senior') NOT NULL
);

CREATE TABLE WorkAssignment (
    work_id INT AUTO_INCREMENT PRIMARY KEY,
    manager_id INT NOT NULL,
    employee_id INT NOT NULL,
    title VARCHAR(150) NOT NULL,
    description TEXT,
    assigned_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    due_date DATE,
    status ENUM('assigned', 'in_progress', 'submitted', 'approved', 'rejected') DEFAULT 'assigned',
    rejection_reason TEXT,
    credit_awarded BOOLEAN DEFAULT FALSE,
    FOREIGN KEY (manager_id) REFERENCES User(user_id),
    FOREIGN KEY (employee_id) REFERENCES User(user_id)
);

CREATE TABLE WorkUpdate (
    update_id INT AUTO_INCREMENT PRIMARY KEY,
    work_id INT NOT NULL,
    update_text TEXT NOT NULL,
    update_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (work_id) REFERENCES WorkAssignment(work_id)
);

CREATE TABLE Appeal (
    appeal_id INT AUTO_INCREMENT PRIMARY KEY,
    work_id INT NOT NULL,
    employee_id INT NOT NULL,
    appeal_reason TEXT NOT NULL,
    appeal_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    status ENUM('pending', 'accepted', 'rejected') DEFAULT 'pending',
    senior_id INT,
    decision_reason TEXT,
    decision_date DATETIME,
    FOREIGN KEY (work_id) REFERENCES WorkAssignment(work_id),
    FOREIGN KEY (employee_id) REFERENCES User(user_id),
    FOREIGN KEY (senior_id) REFERENCES User(user_id)
);

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