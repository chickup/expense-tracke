// 使用fetch API直接操作OSS

interface OSSConfig {
  region: string;
  accessKeyId: string;
  accessKeySecret: string;
  bucket: string;
}

let config: OSSConfig | null = null;

// 初始化OSS配置
export const initOSSClient = (ossConfig: OSSConfig) => {
  config = ossConfig;
  return true;
};

// 检查是否已初始化
export const isOSSInitialized = () => {
  return config !== null;
};

// 获取OSS客户端（返回配置）
export const getOSSClient = () => {
  return config;
};

// 从OSS加载数据
export const loadExpensesFromOSS = async (): Promise<any[]> => {
  if (!config) return [];
  
  try {
    const resource = '/expenses.json';
    const url = `https://${config.bucket}.${config.region}.aliyuncs.com${resource}`;
    const date = new Date().toUTCString();
    const contentMd5 = '';
    const contentType = '';
    const signature = await generateOSS签名(config, 'GET', resource, contentMd5, contentType, date);
    
    const response = await fetch(url, {
      headers: {
        'Date': date,
        'x-oss-access-key-id': config.accessKeyId,
        'x-oss-signature': signature
      }
    });
    
    if (response.status === 404) {
      return [];
    }
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error('OSS加载失败:', error);
    return [];
  }
};

// 生成阿里云OSS签名
const generateOSS签名 = async (config: OSSConfig, method: string, resource: string, contentMd5: string, contentType: string, date: string): Promise<string> => {
  const stringToSign = `${method}\n${contentMd5}\n${contentType}\n${date}\n${resource}`;
  
  try {
    // 使用Web Crypto API生成HMAC-SHA1签名
    const encoder = new TextEncoder();
    const keyData = encoder.encode(config.accessKeySecret);
    const messageData = encoder.encode(stringToSign);
    
    // 导入密钥
    const key = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-1' },
      false,
      ['sign']
    );
    
    // 生成签名
    const signatureBuffer = await crypto.subtle.sign(
      'HMAC',
      key,
      messageData
    );
    
    // 转换为base64字符串
    const signature = btoa(String.fromCharCode(...new Uint8Array(signatureBuffer)));
    return signature;
  } catch (error) {
    console.error('生成签名失败:', error);
    return '';
  }
};

// 保存数据到OSS
export const saveExpensesToOSS = async (expensesData: any[]): Promise<boolean> => {
  if (!config) return false;
  
  try {
    const resource = '/expenses.json';
    const url = `https://${config.bucket}.${config.region}.aliyuncs.com${resource}`;
    const date = new Date().toUTCString();
    const contentMd5 = '';
    const contentType = 'application/json';
    const signature = await generateOSS签名(config, 'PUT', resource, contentMd5, contentType, date);
    
    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        'Content-Type': contentType,
        'Date': date,
        'x-oss-access-key-id': config.accessKeyId,
        'x-oss-signature': signature
      },
      body: JSON.stringify(expensesData)
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    console.log('保存数据到OSS成功');
    return true;
  } catch (error) {
    console.error('OSS保存失败:', error);
    return false;
  }
};
