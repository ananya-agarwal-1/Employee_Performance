# Employee Performance Management System

Employee Performance Management System (EPMS) is a full-stack web application designed to make employee work evaluation more organized and transparent.

The system allows employees to view their work records and track whether their contributions have been credited. Managers can review employee work and approve or reject it. If an employee's work is rejected or not credited, the employee can raise an appeal to a Senior Authority for further review and better acknowledgement of work.

## Features

### Employee
- View employee dashboard
- View submitted work records
- Check work and credit status
- View manager comments
- Submit an appeal for rejected or uncredited work
- Track appeal status and decision

### Manager
- View employee work records
- Review submitted work
- Approve work
- Reject work with a comment
- Track work and credit status

### Senior Authority
- View employee appeals
- Review the original work and manager decision
- Approve or reject appeals
- Add comments while making a decision

## Application Workflow

```text
Employee submits/views work
          ↓
    Manager reviews
          ↓
    ┌─────┴─────┐
    ↓           ↓
 Approve      Reject
    ↓           ↓
  Credited   Employee can appeal
                ↓
        Senior Authority
                ↓
        ┌───────┴───────┐
        ↓               ↓
     Approve          Reject
        ↓               ↓
  Final decision    Final decision
