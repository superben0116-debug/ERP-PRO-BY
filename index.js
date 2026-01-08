import express from 'express';
import cors from 'cors';
import bcryptjs from 'bcryptjs';
import pool from './db.js';

const app = express();
const PORT = process.env.PORT || 8080;

// 中间件
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type']
}));
app.use(express.json());

// 初始化数据库表
async function initializeDatabase() {
  const connection = await pool.getConnection();
  try {
    // 账户表
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS accounts (
        id VARCHAR(50) PRIMARY KEY,
        username VARCHAR(100) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 客户表
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS customers (
        id VARCHAR(50) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        contact VARCHAR(100) NOT NULL,
        phone VARCHAR(20) NOT NULL,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 收款记录表
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS payments (
        id VARCHAR(100) PRIMARY KEY,
        date VARCHAR(50) NOT NULL,
        customerId VARCHAR(50) NOT NULL,
        customerName VARCHAR(255) NOT NULL,
        amount DECIMAL(10, 2) NOT NULL,
        status VARCHAR(50) NOT NULL,
        businessDate VARCHAR(50),
        remarks TEXT,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (customerId) REFERENCES customers(id),
        INDEX idx_date (date),
        INDEX idx_customerId (customerId)
      )
    `);

    // 表格数据表
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS sheet_data (
        id VARCHAR(50) PRIMARY KEY,
        data LONGTEXT NOT NULL,
        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);

    console.log('Database tables initialized successfully');

    // 初始化默认账户
    const defaultAccount = {
      id: 'acc1',
      username: 'dayou',
      password: 'Dayou123?'
    };

    const [accountExists] = await connection.execute(
      'SELECT * FROM accounts WHERE username = ?',
      [defaultAccount.username]
    );

    if (accountExists.length === 0) {
      const hashedPassword = bcryptjs.hashSync(defaultAccount.password, 10);
      await connection.execute(
        'INSERT INTO accounts (id, username, password) VALUES (?, ?, ?)',
        [defaultAccount.id, defaultAccount.username, hashedPassword]
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
      const [customerExists] = await connection.execute(
        'SELECT * FROM customers WHERE id = ?',
        [customer.id]
      );

      if (customerExists.length === 0) {
        await connection.execute(
          'INSERT INTO customers (id, name, contact, phone) VALUES (?, ?, ?, ?)',
          [customer.id, customer.name, customer.contact, customer.phone]
        );
      }
    }

    console.log('Default customers initialized');
  } catch (err) {
    console.error('Database initialization error:', err);
  } finally {
    connection.release();
  }
}

// ==================== 认证接口 ====================

// 登录
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    console.log('Login attempt:', username);

    const connection = await pool.getConnection();
    try {
      const [accounts] = await connection.execute(
        'SELECT * FROM accounts WHERE username = ?',
        [username]
      );

      const account = accounts[0];

      if (!account) {
        console.log('Account not found:', username);
        return res.status(401).json({ error: '用户名或密码错误' });
      }

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
    } finally {
      connection.release();
    }
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: '数据库错误' });
  }
});

// 更新账户
app.put('/api/auth/account', async (req, res) => {
  try {
    const { username, newPassword } = req.body;
    console.log('Update account:', username);

    const hashedPassword = bcryptjs.hashSync(newPassword, 10);
    const connection = await pool.getConnection();
    try {
      await connection.execute(
        'UPDATE accounts SET username = ?, password = ? WHERE id = ?',
        [username, hashedPassword, 'acc1']
      );

      console.log('Account updated');
      res.json({ username });
    } finally {
      connection.release();
    }
  } catch (err) {
    console.error('Update error:', err);
    res.status(500).json({ error: '更新失败' });
  }
});

// ==================== 客户接口 ====================

// 获取所有客户
app.get('/api/customers', async (req, res) => {
  try {
    console.log('Getting customers');
    const connection = await pool.getConnection();
    try {
      const [customers] = await connection.execute(
        'SELECT * FROM customers ORDER BY createdAt DESC'
      );
      console.log('Customers retrieved:', customers.length);
      res.json(customers);
    } finally {
      connection.release();
    }
  } catch (err) {
    console.error('Database error:', err);
    res.status(500).json({ error: '数据库错误' });
  }
});

// 添加客户
app.post('/api/customers', async (req, res) => {
  try {
    const { name, contact, phone } = req.body;
    const id = `c${Date.now()}`;
    console.log('Adding customer:', name);

    const connection = await pool.getConnection();
    try {
      await connection.execute(
        'INSERT INTO customers (id, name, contact, phone) VALUES (?, ?, ?, ?)',
        [id, name, contact, phone]
      );

      console.log('Customer added:', id);
      res.json({ id, name, contact, phone });
    } finally {
      connection.release();
    }
  } catch (err) {
    console.error('Insert error:', err);
    res.status(500).json({ error: '添加失败' });
  }
});

// 更新客户
app.put('/api/customers/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, contact, phone } = req.body;
    console.log('Updating customer:', id);

    const connection = await pool.getConnection();
    try {
      await connection.execute(
        'UPDATE customers SET name = ?, contact = ?, phone = ? WHERE id = ?',
        [name, contact, phone, id]
      );

      console.log('Customer updated:', id);
      res.json({ id, name, contact, phone });
    } finally {
      connection.release();
    }
  } catch (err) {
    console.error('Update error:', err);
    res.status(500).json({ error: '更新失败' });
  }
});

// ==================== 收款记录接口 ====================

// 获取所有收款记录
app.get('/api/payments', async (req, res) => {
  try {
    console.log('Getting payments');
    const connection = await pool.getConnection();
    try {
      const [payments] = await connection.execute(
        'SELECT * FROM payments ORDER BY date DESC'
      );
      console.log('Payments retrieved:', payments.length);
      res.json(payments);
    } finally {
      connection.release();
    }
  } catch (err) {
    console.error('Database error:', err);
    res.status(500).json({ error: '数据库错误' });
  }
});

// 添加收款记录
app.post('/api/payments', async (req, res) => {
  try {
    const { date, customerId, customerName, amount } = req.body;
    const id = `p${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    console.log('Adding payment:', id, 'Amount:', amount);

    const connection = await pool.getConnection();
    try {
      await connection.execute(
        'INSERT INTO payments (id, date, customerId, customerName, amount, status) VALUES (?, ?, ?, ?, ?, ?)',
        [id, date, customerId, customerName, amount, '未核销']
      );

      console.log('Payment added:', id);
      res.json({ id, date, customerId, customerName, amount, status: '未核销' });
    } finally {
      connection.release();
    }
  } catch (err) {
    console.error('Insert error:', err);
    res.status(500).json({ error: '添加失败' });
  }
});

// 更新收款记录
app.put('/api/payments/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { date, customerId, customerName, amount, status, businessDate, remarks } = req.body;
    console.log('Updating payment:', id);

    const connection = await pool.getConnection();
    try {
      await connection.execute(
        'UPDATE payments SET date = ?, customerId = ?, customerName = ?, amount = ?, status = ?, businessDate = ?, remarks = ? WHERE id = ?',
        [date, customerId, customerName, amount, status, businessDate || null, remarks || null, id]
      );

      console.log('Payment updated:', id);
      res.json({ id, date, customerId, customerName, amount, status, businessDate, remarks });
    } finally {
      connection.release();
    }
  } catch (err) {
    console.error('Update error:', err);
    res.status(500).json({ error: '更新失败' });
  }
});

// 删除收款记录
app.delete('/api/payments/:id', async (req, res) => {
  try {
    const { id } = req.params;
    console.log('Deleting payment:', id);

    const connection = await pool.getConnection();
    try {
      await connection.execute('DELETE FROM payments WHERE id = ?', [id]);

      console.log('Payment deleted:', id);
      res.json({ success: true });
    } finally {
      connection.release();
    }
  } catch (err) {
    console.error('Delete error:', err);
    res.status(500).json({ error: '删除失败' });
  }
});

// 核销收款记录
app.post('/api/payments/verify', async (req, res) => {
  try {
    const { ids, businessDate, remarks } = req.body;
    console.log('Verifying payments:', ids);

    const connection = await pool.getConnection();
    try {
      const placeholders = ids.map(() => '?').join(',');
      await connection.execute(
        `UPDATE payments SET status = ?, businessDate = ?, remarks = ? WHERE id IN (${placeholders})`,
        ['已核销', businessDate, remarks, ...ids]
      );

      console.log('Payments verified');
      res.json({ success: true });
    } finally {
      connection.release();
    }
  } catch (err) {
    console.error('Verify error:', err);
    res.status(500).json({ error: '核销失败' });
  }
});

// 撤销核销
app.post('/api/payments/:id/undo-verification', async (req, res) => {
  try {
    const { id } = req.params;
    console.log('Undoing verification:', id);

    const connection = await pool.getConnection();
    try {
      await connection.execute(
        'UPDATE payments SET status = ?, businessDate = NULL, remarks = NULL WHERE id = ?',
        ['未核销', id]
      );

      console.log('Verification undone:', id);
      res.json({ success: true });
    } finally {
      connection.release();
    }
  } catch (err) {
    console.error('Undo error:', err);
    res.status(500).json({ error: '撤销失败' });
  }
});

// ==================== 表格数据接口 ====================

// 保存表格数据
app.post('/api/sheet/save', async (req, res) => {
  try {
    const { sheetData } = req.body;
    const id = 'sheet_main';
    console.log('Saving sheet data');

    const connection = await pool.getConnection();
    try {
      await connection.execute(
        'INSERT INTO sheet_data (id, data) VALUES (?, ?) ON DUPLICATE KEY UPDATE data = ?, updatedAt = CURRENT_TIMESTAMP',
        [id, JSON.stringify(sheetData), JSON.stringify(sheetData)]
      );

      console.log('Sheet data saved');
      res.json({ success: true });
    } finally {
      connection.release();
    }
  } catch (err) {
    console.error('Save error:', err);
    res.status(500).json({ error: '保存失败' });
  }
});

// 加载表格数据
app.get('/api/sheet/load', async (req, res) => {
  try {
    console.log('Loading sheet data');
    const connection = await pool.getConnection();
    try {
      const [rows] = await connection.execute(
        'SELECT data FROM sheet_data WHERE id = ?',
        ['sheet_main']
      );

      if (rows.length === 0) {
        return res.json({ data: null });
      }

      try {
        const data = JSON.parse(rows[0].data);
        res.json({ data });
      } catch (e) {
        console.error('Parse error:', e);
        res.json({ data: null });
      }
    } finally {
      connection.release();
    }
  } catch (err) {
    console.error('Load error:', err);
    res.status(500).json({ error: '加载失败' });
  }
});

// 健康检查
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// 启动服务器
async function startServer() {
  try {
    // 尝试连接数据库，但不强制要求
    try {
      const connection = await pool.getConnection();
      await connection.execute('SELECT 1');
      connection.release();
      console.log('Database connection successful');
      await initializeDatabase();
    } catch (dbErr) {
      console.warn('Database connection failed, continuing without database:', dbErr.message);
    }

    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

startServer();
