import { Router } from 'express';
import {
  createBookingRequest,
  createContactRequest,
} from '../controllers/request.controller.js';
import { validateRequest } from '../middlewares/validation.middleware.js';
import {
  createBookingRequestSchema,
  createContactRequestSchema,
} from '../validations/request.validation.js';

const router = Router();

router.post('/bookings', validateRequest(createBookingRequestSchema), createBookingRequest);
router.post('/contacts', validateRequest(createContactRequestSchema), createContactRequest);

export default router;
