const { createLogger, format, transports } = require('winston');
const { combine, timestamp, printf, colorize, json, errors } = format;
const DailyRotateFile = require('winston-daily-rotate-file');

// Update the consoleFormat to handle undefined errors
const consoleFormat = printf(({ level, message, timestamp, stack }) => {
  const logMessage = message || 'No error message provided';
  const log = `${timestamp} [${level.toUpperCase()}]: ${logMessage}`;
  return stack ? `${log}\n${stack}` : log;
});

const fileFormat = printf(({ level, message, timestamp, stack }) => {
  return JSON.stringify({
    timestamp,
    level: level.toUpperCase(),
    message,
    stack: stack || null
  });
});

const logger = createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: combine(
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    errors({ stack: true }),
    process.env.NODE_ENV === 'production' ? json() : combine(colorize(), consoleFormat)
  ),
  transports: [
    new transports.Console(),
    new DailyRotateFile({
      filename: 'logs/application-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      zippedArchive: true,
      maxSize: '20m',
      maxFiles: '14d',
      format: combine(timestamp(), fileFormat)
    }),
    new transports.File({
      filename: 'logs/error.log',
      level: 'error',
      format: combine(timestamp(), fileFormat)
    })
  ],
  exceptionHandlers: [
    new transports.File({ filename: 'logs/exceptions.log' })
  ]
});

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled Rejection:', reason);
});

module.exports = logger;