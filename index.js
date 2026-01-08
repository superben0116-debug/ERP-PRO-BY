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
