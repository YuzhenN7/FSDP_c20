CREATE TABLE IF NOT EXISTS students (
  student_id SERIAL PRIMARY KEY,
  name VARCHAR(100),
  email VARCHAR(150),
  dob DATE,
  belt VARCHAR(30),
  membership_status VARCHAR(20) DEFAULT 'active',
  last_promotion_date DATE
);

INSERT INTO students (name, email, dob, belt) VALUES
('Test Adult', 'adult@test.com', '2000-01-01', 'white'),
('Test Child', 'child@test.com', '2014-05-05', 'white');