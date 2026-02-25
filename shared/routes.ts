import { z } from 'zod';
import {
  destinationRecommendationResponseSchema,
  tripRequestSchema,
  tripResponseSchema,
} from './schema';

export const errorSchemas = {
  validation: z.object({
    message: z.string(),
    field: z.string().optional(),
  }),
  internal: z.object({
    message: z.string(),
  }),
};

export const api = {
  trips: {
    recommend: {
      method: 'POST' as const,
      path: '/api/recommend-destinations' as const,
      input: tripRequestSchema,
      responses: {
        200: destinationRecommendationResponseSchema,
        400: errorSchemas.validation,
        500: errorSchemas.internal,
      },
    },
    generate: {
      method: 'POST' as const,
      path: '/api/generate-itinerary' as const,
      input: tripRequestSchema,
      responses: {
        200: tripResponseSchema,
        400: errorSchemas.validation,
        500: errorSchemas.internal,
      },
    },
  },
};

export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}
