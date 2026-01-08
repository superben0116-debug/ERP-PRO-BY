import express from 'express';
import cors from 'cors';
import sqlite3 from 'sqlite3';
import bcryptjs from 'bcryptjs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 8080;

// 中间件
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type']
}));
app.use(express.json());

// 初始化数据库
const db = new sqlite3.Database(join(__dirname, 'data.db'), (err) => {
  if (err) {
    console.error('Database connection error:', err);
  } else {
    console.log('Database connected successfully');
  }
});

// 创建表
db.serialize(() => {
  // 账户表
  db.run(`
    CREATE TABLE IF NOT EXISTS accounts (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      createdAt TEXT NOT NULL
    )
  `, (err) => {
    if (err) console.error('Error creating accounts table:', err);
  });

  // 客户表
  db.run(`
    CREATE TABLE IF NOT EXISTS customers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      contact TEXT NOT NULL,
      phone TEXT NOT NULL,
      createdAt TEXT NOT NULL
    )
  `, (err) => {
    if (err) console.error('Error creating customers table:', err);
  });

  // 收款记录表
  db.run(`
    CREATE TABLE IF NOT EXISTS payments (
      id TEXT PRIMARY KEY,
      date TEXT NOT NULL,
      customerId TEXT NOT NULL,
      customerName TEXT NOT NULL,
      amount REAL NOT NULL,
      status TEXT NOT NULL,
      businessDate TEXT,
      remarks TEXT,
      createdAt TEXT NOT NULL,
      FOREIGN KEY (customerId) REFERENCES customers(id)
    )
  `, (err) => {
    if (err) console.error('Error creating payments table:', err);
  });

  // 表格*
