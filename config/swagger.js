const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');
const os = require('os');

const getLocalIp = () => {
  const interfaces = os.networkInterfaces();
  for (const name in interfaces) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
};

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Vehicle Dealership Management System API',
      version: '1.0.0',
      description: 'API documentation for the dealership system',
      contact: {
        name: 'API Support',
        email: 'support@dealership.com'
      }
    },
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT'
        }
      }
    },
    security: [{ bearerAuth: [] }]
  },
  apis: ['./routes/*.js']
};

const specs = swaggerJsdoc(options);

const swaggerUiOptions = {
  customSiteTitle: "Vehicle Dealership API Docs",
  customCss: '.swagger-ui .topbar { display: none }',
  swaggerOptions: {
    validatorUrl: null,
    persistAuthorization: true
  }
};

const setupSwagger = (app) => {
  //  Serve dynamic server host Swagger JSON
  app.get('/api-docs/swagger.json', (req, res) => {
    const dynamicSpecs = {
      ...specs,
      servers: [
        {
          url: `${req.protocol}://${req.headers.host}`,
          description: 'Dynamic - based on request origin'
        }
      ]
    };
    res.setHeader('Content-Type', 'application/json');
    res.send(dynamicSpecs);
  });

  // ✅ Serve Swagger UI
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(null, {
    ...swaggerUiOptions,
    explorer: true,
    swaggerUrl: '/api-docs/swagger.json'
  }));
};

module.exports = {
  setupSwagger,
  getLocalIp
};
