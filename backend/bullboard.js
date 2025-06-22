const { ExpressAdapter } = require('@bull-board/express');
const { createBullBoard } = require('@bull-board/api');
const { BullAdapter } = require('@bull-board/api/bullAdapter');
const rideCancellationQueue = require('./queues/ProcessRiderQue');

const setupBullBoard = (app) => {
  const serverAdapter = new ExpressAdapter();
  serverAdapter.setBasePath('/admin/queues'); // Set the base path for Bull Board

  createBullBoard({
    queues: [new BullAdapter(rideCancellationQueue)], // Add your queues here
    serverAdapter,
  });

  app.use('/admin/queues', serverAdapter.getRouter()); // Mount the Bull Board route
};

module.exports = setupBullBoard;