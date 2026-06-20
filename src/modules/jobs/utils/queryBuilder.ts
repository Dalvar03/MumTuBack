import { JobStatus, Prisma } from '@prisma/client';

export function buildJobsWhere(params: {
  status: JobStatus;
  workerLat: number;
  workerLon: number;
  radiusKm: number;
  minPrice?: number;
  maxPrice?: number;
  category?: string;
}) {
  const conditions: Prisma.Sql[] = [
    Prisma.sql`j.status = ${params.status}::"JobStatus"`,
    Prisma.sql`j.latitude IS NOT NULL`,
    Prisma.sql`j.longitude IS NOT NULL`,
  ];

  if (params.minPrice !== undefined) {
    conditions.push(Prisma.sql`j.price >= ${params.minPrice}`);
  }

  if (params.maxPrice !== undefined) {
    conditions.push(Prisma.sql`j.price <= ${params.maxPrice}`);
  }

  if (params.category !== undefined) {
    conditions.push(Prisma.sql`j.category = ${params.category}`);
  }

  // distance condition
  const dist = distanceSql(params.workerLat, params.workerLon);
  conditions.push(Prisma.sql`${dist} <= ${params.radiusKm}`);

  return Prisma.sql`${Prisma.join(conditions, ' AND ')}`;
}

function distanceSql(lat: number, lon: number) {
  return Prisma.sql`
    6371 * acos(
      cos(radians(${lat}))
      * cos(radians(j.latitude))
      * cos(radians(j.longitude) - radians(${lon}))
      + sin(radians(${lat}))
      * sin(radians(j.latitude))
    )
  `;
}
