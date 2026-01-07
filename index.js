import express from 'express';
import cors from 'cors';
import mysql from 'mysql2/promise';
import bcryptjs from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8080;

// 中间件
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type']
}));
app.use(express.json());

// MySQL 连接池
const pool = mysql.createPool({
  host: process.env.MYSQL_HOST || 'localhost',
  user: process.env.MYSQL_USERNAME || 'root',
  password: process.env.MYSQL_PASSWORD || '',
  database: process.env.MYSQL_DATABASE || 'erp_pro',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// 初始化数据库
async function initializeDatabase() {
  const connection = await pool.getConnection();
  try {
    // 创建账户表
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS accounts (
        id VARCHAR(50) PRIMARY KEY,
        username VARCHAR(100) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 创建客户表
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS customers (
        id VARCHAR(50) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        contact VARCHAR(100),
        phone VARCHAR(20),
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 创建收款记录表
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS payments (
        id VARCHAR(100) PRIMARY KEY,
        date DATE NOT NULL,
        customerId VARCHAR(50),
        customerName VARCHAR(255) NOT NULL,
        amount DECIMAL(10, 2) NOT NULL,
        status VARCHAR(50) DEFAULT '未核销',
        businessDate DATE,
        remarks TEXT,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (customerId) REFERENCES customers(id)
      )
    `);

    // 初始化默认账户
    const [accounts] = await connection.execute('SELECT * FROM accounts WHERE username = ?', ['dayou']);
    if (accounts.length === 0) {
      const hashedPassword = bcryptjs.hashSync('Dayou123?', 10);
      await connection.execute(
        'INSERT INTO accounts (id, username, password) VALUES (?, ?, ?)',
        ['acc1', 'dayou', hashedPassword]
      );
      console.log('Default account created');
    }

    // 初始化默认客户
    const defaultCustomers = [
      { id: 'c1', name: '上海宏泰塑胶有限公司', contact: '王经理', phone: '138-0000-1111' },
      { id: 'c2', name: '深圳飞龙模具制造厂', contact: '李主管', phone: '139-2222-3333' },
      { id: 'c3', name: '大友硅胶工艺制品部', contact: '刘工', phone: '137-4444-5555' },
    ];

    for (const customer of defaultCustomers) {
      const [existing] = await connection.execute('SELECT * FROM customers WHERE id = ?', [customer.id]);
      if (existing.length === 0) {
        await connection.execute(
          'INSERT INTO customers (id, name, contact, phone) VALUES (?, ?, ?, ?)',
          [customer.id, customer.name, customer.contact, customer.phone]
        );
      }
    }

    console.log('Database initialized successfully');
  } catch (err) {
    console.error('Database initialization error:', err);
  } finally {
    connection.release();
  }
}

// 初始化数据库
initializeDatabase();

// ==================== 认证接口 ====================

// 登录
app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  console.log('Login attempt:', username);

  try {
    const connection = await pool.getConnection();
    const [accounts] = await connection.execute('SELECT * FROM accounts WHERE username = ?', [username]);
    connection.release();

    if (accounts.length === 0) {
      console.log('Account not found:', username);
      return res.status(401).json({ error: '用户名或密码错误' });
    }

    const account = accounts[0];
    const isPasswordValid = bcryptjs.compareSync(password, account.password);
    if (!isPasswordValid) {
      console.log('Invalid password for:', username);
      return res.status(401).json({ error: '用户名或密码错误' });
    }

    console.log('Login successful:', username);
    res.json({
      id: account.id,
      username: account.username
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: '登录失败' });
  }
});

// 更新账户
app.put('/api/auth/account', async (req, res) => {
  const { username, newPassword } = req.body;
  console.log('Update account:', username);

  try {
    const hashedPassword = bcryptjs.hashSync(newPassword, 10);
    const connection = await pool.getConnection();
    await connection.execute(
      'UPDATE accounts SET username = ?, password = ? WHERE id = ?',
      [username, hashedPassword, 'acc1']
    );
    connection.release();

    console.log('Account updated');
    res.json({ username });
  } catch (err) {
    console.error('Update error:', err);
    res.status(500).json({ error: '更新失败' });
  }
});

// ==================== 客户接口 ====================

// 获取所有客户
app.get('/api/customers', async (req, res) => {
  console.log('Getting customers');
  try {
    const connection = await pool.getConnection();
    const [customers] = await connection.execute('SELECT * FROM customers ORDER BY createdAt DESC');
    connection.release();

    console.log('Customers retrieved:', customers.length);
    res.json(customers || []);
  } catch (err) {
    console.error('Database error:', err);
    res.status(500).json({ error: '数据库错误' });
  }
});

// 添加客户
app.post('/api/customers', async (req, res) => {
  const { name, contact, phone } = req.body;
  const id = `c${Date.now()}`;
  console.log('Adding customer:', name);

  try {
    const connection = await pool.getConnection();
    await connection.execute(
      'INSERT INTO customers (id, name, contact, phone) VALUES (?, ?, ?, ?)',
      [id, name, contact, phone]
    );
    connection.release();

    console.log('Customer added:', id);
    res.json({ id, name, contact, phone });
  } catch (err) {
    console.error('Insert error:', err);
    res.status(500).json({ error: '添加失败' });
  }
});

// 更新客户
app.put('/api/customers/:id', async (req, res) => {
  const { id } = req.params;
  const { name, contact, phone } = req.body;
  console.log('Updating customer:', id);

  try {
    const connection = await pool.getConnection();
    await connection.execute(
      'UPDATE customers SET name = ?, contact = ?, phone = ? WHERE id = ?',
      [name, contact, phone, id]
    );
    connection.release();

    console.log('Customer updated:', id);
    res.json({ id, name, contact, phone });
  } catch (err) {
    console.error('Update error:', err);
    res.status(500).json({ error: '更新失败' });
  }
});

// ==================== 收款记录接口 ====================

// 获取所有收款记录
app.get('/api/payments', async (req, res) => {
  console.log('Getting payments');
  try {
    const connection = await pool.getConnection();
    const [payments] = await connection.execute('SELECT * FROM payments ORDER BY date DESC');
    connection.release();

    console.log('Payments retrieved:', payments.length);
    res.json(payments || []);
  } catch (err) {
    console.error('Database error:', err);
    res.status(500).json({ error: '数据库错误' });
  }
});

// 添加收款记录
app.post('/api/payments', async (req, res) => {
  const { date, customerId, customerName, amount } = req.body;
  const id = `p${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  console.log('Adding payment:', id, 'Amount:', amount);

  try {
    const connection = await pool.getConnection();
    await connection.execute(
      'INSERT INTO payments (id, date, customerId, customerName, amount, status) VALUES (?, ?, ?, ?, ?, ?)',
      [id, date, customerId, customerName, amount, '未核销']
    );
    connection.release();

    console.log('Payment added:', id);
    res.json({ id, date, customerId, customerName, amount, status: '未核销' });
  } catch (err) {
    console.error('Insert error:', err);
    res.status(500).json({ error: '添加失败' });
  }
});

// 更新收款记录
app.put('/api/payments/:id', async (req, res) => {
  const { id } = req.params;
  const { date, customerId, customerName, amount, status, businessDate, remarks } = req.body;
  console.log('Updating payment:', id);

  try {
    const connection = await pool.getConnection();
    await connection.execute(
      'UPDATE payments SET date = ?, customerId = ?, customerName = ?, amount = ?, status = ?, businessDate = ?, remarks = ? WHERE id = ?',
      [date, customerId, customerName, amount, status, businessDate || null, remarks || null, id]
    );
    connection.release();

    console.log('Payment updated:', id);
    res.json({ id, date, customerId, customerName, amount, status, businessDate, remarks });
  } catch (err) {
    console.error('Update error:', err);
    res.status(500).json({ error: '更新失败' });
  }
});

// 删除收款记录
app.delete('/api/payments/:id', async (req, res) => {
  const { id } = req.params;
  console.log('Deleting payment:', id);

  try {
    const connection = await pool.getConnection();
    await connection.execute('DELETE FROM payments WHERE id = ?', [id]);
    connection.release();

    console.log('Payment deleted:', id);
    res.json({ success: true });
  } catch (err) {
    console.error('Delete error:', err);
    res.status(500).json({ error: '删除失败' });
  }
});

// 核销收款记录
app.post('/api/payments/verify', async (req, res) => {
  const { ids, businessDate, remarks } = req.body;
  console.log('Verifying payments:', ids);

  try {
    const connection = await pool.getConnection();
    const placeholders = ids.map(() => '?').join(',');
    await connection.execute(
      `UPDATE payments SET status = ?, businessDate = ?, remarks = ? WHERE id IN (${placeholders})`,
      ['已核销', businessDate, remarks, ...ids]
    );
    connection.release();

    console.log('Payments verified');
    res.json({ success: true });
  } catch (err) {
    console.error('Verify error:', err);
    res.status(500).json({ error: '核销失败' });
  }
});

// 撤销核销
app.post('/api/payments/:id/undo-verification', async (req, res) => {
  const { id } = req.params;
  console.log('Undoing verification:', id);

  try {
    const connection = await pool.getConnection();
    await connection.execute(
      'UPDATE payments SET status = ?, businessDate = NULL, remarks = NULL WHERE id = ?',
      ['未核销', id]
    );
    connection.release();

    console.log('Verification undone:', id);
    res.json({ success: true });
  } catch (err) {
    console.error('Undo error:', err);
    res.status(500).json({ error: '撤销失败' });
  }
});

// 健康检查
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
