// ==================== 表格数据接口 ====================

// 保存表格数据
app.post('/api/sheet/save', (req, res) => {
  const { sheetData } = req.body;
  const id = 'sheet_main';
  console.log('Saving sheet data');

  db.run(
    `INSERT OR REPLACE INTO sheet_data (id, data, updatedAt) VALUES (?, ?, ?)`,
    [id, JSON.stringify(sheetData), new Date().toISOString()],
    function(err) {
      if (err) {
        console.error('Save error:', err);
        return res.status(500).json({ error: '保存失败' });
      }
      console.log('Sheet data saved');
      res.json({ success: true });
    }
  );
});

// 加载表格数据
app.get('/api/sheet/load', (req, res) => {
  console.log('Loading sheet data');
  db.get('SELECT data FROM sheet_data WHERE id = ?', ['sheet_main'], (err, row) => {
    if (err) {
      console.error('Load error:', err);
      return res.status(500).json({ error: '加载失败' });
    }
    if (!row) {
      return res.json({ data: null });
    }
    try {
      const data = JSON.parse(row.data);
      res.json({ data });
    } catch (e) {
      console.error('Parse error:', e);
      res.json({ data: null });
    }
  });
});
