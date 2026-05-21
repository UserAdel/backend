import { Router } from 'express';
import {
  initiatePayment,
  handleKashierWebhook,
  handlePaymentSuccess,
} from '../controllers/payment.controller.js';

const router = Router();

router.post('/payments/initiate', initiatePayment);
router.post('/payments/kashier/webhook', handleKashierWebhook);
router.get('/payments/kashier/success', handlePaymentSuccess);

export default router;
