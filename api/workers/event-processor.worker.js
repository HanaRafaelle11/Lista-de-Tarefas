import eventProcessorHandler from './event-processor.js';

export default async function handler(req, res) {
  return await eventProcessorHandler(req, res);
}
