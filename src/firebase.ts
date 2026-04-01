import { initializeApp } from 'firebase/app';
import { getDatabase } from 'firebase/database';

// Firebase配置
const firebaseConfig = {
  apiKey: "AIzaSyDKL8m1Z5Z0Y9X7Z8Z9Z0Y9X7Z8Z9Z0Y9",
  authDomain: "expense-tracker-12345.firebaseapp.com",
  projectId: "expense-tracker-12345",
  storageBucket: "expense-tracker-12345.appspot.com",
  messagingSenderId: "123456789012",
  appId: "1:123456789012:web:1234567890abcdef123456"
};

// 初始化Firebase
const app = initializeApp(firebaseConfig);

// 获取实时数据库实例
const database = getDatabase(app);

export { database };
