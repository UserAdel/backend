import { Router } from 'express';
import { getTestimonials } from '../controllers/testimonial.controller.js';

const router = Router();

router.get('/testimonials', getTestimonials);

export default router;
