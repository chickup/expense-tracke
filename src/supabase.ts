import { createClient } from '@supabase/supabase-js';

// Supabase配置
const supabaseUrl = 'https://your-project-url.supabase.co';
const supabaseAnonKey = 'your-anon-key';

// 创建Supabase客户端
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export { supabase };
