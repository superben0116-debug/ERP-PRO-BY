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
  try {
    // 账户表
    await pool.query(`
      CREATE TABLE IF NOT EXISTS accounts (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 客户表
    await pool.query(`
      CREATE TABLE IF NOT EXISTS customers (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        contact TEXT NOT NULL,
        phone TEXT NOT NULL,
        "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 收款记录表
    await pool.query(`
      CREATE TABLE IF NOT EXISTS payments (
        id TEXT PRIMARY KEY,
        date TEXT NOT NULL,
        "customerId" TEXT NOT NULL,
        "customerName" TEXT NOT NULL,
        amount DECIMAL(10, 2) NOT NULL,
        status TEXT NOT NULL,
        "businessDate" TEXT,
        remarks TEXT,
        "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY ("customerId") REFERENCES customers(id)
      )
    `);

    // 表格数据表
    await pool.query(`
      CREATE TABLE IF NOT EXISTS sheet_data (
        id TEXT PRIMARY KEY,
        data TEXT NOT NULL,
        "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    console.log('Database tables initialized successfully');

    // 初始化默认账户
    const defaultAccount = {
      id: 'acc1',
      username: 'dayou',
      password: 'Dayou123?'
    };

    const accountExists = await pool.query(
      'SELECT * FROM accounts WHERE username = $1',
      [defaultAccount.username]
    );

    if (accountExists.rows.length === 0) {
      const hashedPassword = bcryptjs.hashSync(defaultAccount.password, 10);
      await pool.query(
        'INSERT INTO accounts (id, username, password) VALUES ($1, $2, $3)',
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
      const customerExists = await pool.query(
        'SELECT * FROM customers WHERE id = $1',
        [customer.id]
      );

      if (customerExists.rows.length === 0) {
        await pool.query(
          'INSERT INTO customers (id, name, contact, phone) VALUES ($1, $2, $3, $4)',
          [customer.id, customer.name, customer.contact, customer.phone]
        );
      }
    }

    console.log('Default customers initialized');
  } catch (err) {
    console.error('Database initialization error:', err);
  }
}

// ==================== 认证接口 ====================

// 登录
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    console.log('Login attempt:', username);

    const result = await pool.query(
      'SELECT * FROM accounts WHERE username = $1',
      [username]
    );

    const account = result.rows[0];

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
    await pool.query(
      'UPDATE accounts SET username = $1, password = $2 WHERE id = $3',
      [username, hashedPassword, 'acc1']
    );

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
  try {
    console.log('Getting customers');
    const result = await pool.query(
      'SELECT * FROM customers ORDER BY "createdAt" DESC'
    );
    console.log('Customers retrieved:', result.rows.length);
    res.json(result.rows);
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

    const result = await pool.query(
      'INSERT INTO customers (id, name, contact, phone) VALUES ($1, $2, $3, $4) RETURNING *',
      [id, name, contact, phone]
    );

    console.log('Customer added:', id);
    res.json(result.rows[0]);
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

    const result = await pool.query(
      'UPDATE customers SET name = $1, contact = $2, phone = $3 WHERE id = $4 RETURNING *',
      [name, contact, phone, id]
    );

    console.log('Customer updated:', id);
    res.json(result.rows[0]);
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
    const result = await pool.query(
      'SELECT * FROM payments ORDER BY date DESC'
    );
    console.log('Payments retrieved:', result.rows.length);
    res.json(result.rows);
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

    const result = await pool.query(
      'INSERT INTO payments (id, date, "customerId", "customerName", amount, status) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [id, date, customerId, customerName, amount, '未核销']
    );

    console.log('Payment added:', id);
    res.json(result.rows[0]);
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

    const result = await pool.query(
      'UPDATE payments SET date = $1, "customerId" = $2, "customerName" = $3, amount = $4, status = $5, "businessDate" = $6, remarks = $7 WHERE id = $8 RETURNING *',
      [date, customerId, customerName, amount, status, businessDate || null, remarks || null, id]
    );

    console.log('Payment updated:', id);
    res.json(result.rows[0]);
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

    await pool.query('DELETE FROM payments WHERE id = $1', [id]);

    console.log('Payment deleted:', id);
    res.json({ success: true });
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

    const placeholders = ids.map((_, i) => `$${i + 1}`).join(',');
    await pool.query(
      `UPDATE payments SET status = $${ids.length + 1}, "businessDate" = $${ids.length + 2}, remarks = $${ids.length + 3} WHERE id IN (${placeholders})`,
      [...ids, '已核销', businessDate, remarks]
    );

    console.log('Payments verified');
    res.json({ success: true });
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

    await pool.query(
      'UPDATE payments SET status = $1, "businessDate" = NULL, remarks = NULL WHERE id = $2',
      ['未核销', id]
    );

    console.log('Verification undone:', id);
    res.json({ success: true });
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

    await pool.query(
      'INSERT INTO sheet_data (id, data, "updatedAt") VALUES ($1, $2, CURRENT_TIMESTAMP) ON CONFLICT (id) DO UPDATE SET data = $2, "updatedAt" = CURRENT_TIMESTAMP',
      [id, JSON.stringify(sheetData)]
    );

    console.log('Sheet data saved');
    res.json({ success: true });
  } catch (err) {
    console.error('Save error:', err);
    res.status(500).json({ error: '保存失败' });
  }
});

// 加载表格数据
app.get('/api/sheet/load', async (req, res) => {
  try {
    console.log('Loading sheet data');
    const result = await pool.query(
      'SELECT data FROM sheet_data WHERE id = $1',
      ['sheet_main']
    );

    if (result.rows.length === 0) {
      return res.json({ data: null });
    }

    try {
      const data = JSON.parse(result.rows[0].data);
      res.json({ data });
    } catch (e) {
      console.error('Parse error:', e);
      res.json({ data: null });
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
    // 测试数据库连接
    await pool.query('SELECT NOW()');
    console.log('Database connection successful');

    // 初始化数据库
    await initializeDatabase();

    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

startServer();
