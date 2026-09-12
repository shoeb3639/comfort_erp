import type { PageRequest } from '../../shared/pagination'
import { pageResult } from '../../shared/pagination'
import { env } from '../../config/env'
import * as repository from './city.repository'

interface PlaceSearchInput {
  query: string
  latitude?: number
  longitude?: number
}

interface ReportingPlace {
  id: string
  displayName: string
  latitude: number
  longitude: number
  type: string | null
}

interface PlaceSearchResult {
  items: ReportingPlace[]
  providerAvailable: boolean
}

const placeCache = new Map<
  string,
  { expiresAt: number; result: PlaceSearchResult }
>()

function textValue(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null
}

function numberValue(value: unknown): number | null {
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function mapLocationIqResult(value: unknown): ReportingPlace | null {
  if (!value || typeof value !== 'object') return null
  const item = value as Record<string, unknown>
  const displayName = textValue(item.display_name)
  const latitude = numberValue(item.lat)
  const longitude = numberValue(item.lon)
  if (!displayName || latitude === null || longitude === null) return null
  return {
    id: textValue(item.place_id) ?? `${latitude},${longitude}`,
    displayName,
    latitude,
    longitude,
    type: textValue(item.type),
  }
}

function cacheKey(input: PlaceSearchInput): string {
  return [
    input.query.trim().toLowerCase(),
    input.latitude?.toFixed(2) ?? '',
    input.longitude?.toFixed(2) ?? '',
  ].join('|')
}

function setCached(key: string, result: PlaceSearchResult): void {
  if (placeCache.size >= 500) {
    const oldestKey = placeCache.keys().next().value
    if (oldestKey) placeCache.delete(oldestKey)
  }
  placeCache.set(key, {
    expiresAt: Date.now() + env.locationIq.cacheTtlMs,
    result,
  })
}

export async function searchIndianCities(
  filters: PageRequest & { query?: string },
) {
  const [cities, total] = await repository.searchIndianCities(filters)
  return pageResult(
    cities.map((city) => ({
      ...city,
      displayName: `${city.name}, ${city.stateName}`,
      latitude: city.latitude?.toNumber() ?? null,
      longitude: city.longitude?.toNumber() ?? null,
    })),
    total,
    filters,
  )
}

export async function searchReportingPlaces(
  input: PlaceSearchInput,
): Promise<PlaceSearchResult> {
  if (!env.locationIq.apiKey) return { items: [], providerAvailable: false }

  const key = cacheKey(input)
  const cached = placeCache.get(key)
  if (cached && cached.expiresAt > Date.now()) return cached.result
  if (cached) placeCache.delete(key)

  const parameters = new URLSearchParams({
    key: env.locationIq.apiKey,
    q: input.query.trim(),
    countrycodes: 'in',
    format: 'json',
    addressdetails: '1',
    normalizecity: '1',
    limit: '8',
  })
  if (input.latitude !== undefined && input.longitude !== undefined) {
    const latitudeRadius = 0.4
    const longitudeRadius = 0.4
    parameters.set(
      'viewbox',
      [
        input.longitude - longitudeRadius,
        input.latitude + latitudeRadius,
        input.longitude + longitudeRadius,
        input.latitude - latitudeRadius,
      ].join(','),
    )
    parameters.set('bounded', '0')
  }

  try {
    const response = await fetch(
      `https://api.locationiq.com/v1/autocomplete?${parameters.toString()}`,
      { signal: AbortSignal.timeout(env.locationIq.timeoutMs) },
    )
    if (!response.ok) return { items: [], providerAvailable: false }
    const body: unknown = await response.json()
    const result = {
      items: Array.isArray(body)
        ? body.flatMap((item) => {
            const place = mapLocationIqResult(item)
            return place ? [place] : []
          })
        : [],
      providerAvailable: true,
    }
    setCached(key, result)
    return result
  } catch {
    return { items: [], providerAvailable: false }
  }
}
