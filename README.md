# ERP PRO Backend

Express.js + MySQL 后端 API 服务

## 功能特性

- 用户认证（登录、账户管理）
- 客户管理（增删改查）
- 收款记录管理（增删改查、核销、撤销核销）
- MySQL 数据库支持
- CORS 跨域支持

## 快速开始

### 本地开发

1. 安装依赖
```bash
npm install
```

2. 配置环境变量
```bash
cp .env.example .env
# 编辑 .env 文件，配置 MySQL 连接信息
```

3. 启动开发服务器
```bash
npm run dev
```

4. 启动生产服务器
```bash
npm start
```

## API 端点

### 认证
- `POST /api/auth/login` - 登录
- `PUT /api/auth/account` - 更新账户

### 客户管理
- `GET /api/customers` - 获取所有客户
- `POST /api/customers` - 添加客户
- `PUT /api/customers/:id` - 更新客户

### 收款记录
- `GET /api/payments` - 获取所有收款记录
- `POST /api/payments` - 添加收款记录
- `PUT /api/payments/:id` - 更新收款记录
- `DELETE /api/payments/:id` - 删除收款记录
- `POST /api/payments/verify` - 核销收款记录
- `POST /api/payments/:id/undo-verification` - 撤销核销

## 默认账户

- 用户名: `dayou`
- 密码: `Dayou123?`

## 部署到 Zeabur

1. 将代码推送到 GitHub
2. 在 Zeabur 中创建新服务
3. 连接 GitHub 仓库
4. 配置环境变量（MySQL 连接信息）
5. 部署
