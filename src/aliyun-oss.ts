import OSS from 'ali-oss';

let client: OSS | null = null;

// 初始化OSS客户端
export const initOSSClient = (config: {
  region: string;
  accessKeyId: string;
  accessKeySecret: string;
  bucket: string;
}) => {
  client = new OSS(config);
  return client;
};

// 获取OSS客户端
export const getOSSClient = () => {
  return client;
};

// 检查是否已初始化
export const isOSSInitialized = () => {
  return client !== null;
};
