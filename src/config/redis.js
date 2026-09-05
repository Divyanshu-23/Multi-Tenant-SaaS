const redis = require('redis');

let redisClient = null;

const connectRedis = async () => {
  try {
    redisClient = redis.createClient({
      url: `redis://${process.env.REDIS_HOST || 'localhost'}:${process.env.REDIS_PORT || 6379}`,
      password: process.env.REDIS_PASSWORD || undefined,
    });

    redisClient.on('error', (err) => {
      console.error('Redis Client Error:', err);
    });

    redisClient.on('connect', () => {
      console.warn('Redis Client Connected');
    });

    await redisClient.connect();
  } catch (error) {
    console.error('Failed to connect to Redis:', error.message);
  }
};

const disconnectRedis = async () => {
  try {
    if (redisClient) {
      await redisClient.quit();
      console.log('Redis disconnected');
      redisClient = null;
    }
  } catch (error) {
    console.error('Error disconnecting Redis:', error.message);
  }
};

const getRedisClient = () => redisClient;

module.exports = { connectRedis, disconnectRedis, getRedisClient };