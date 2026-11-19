export interface ScrapedImage {
  url: string;
  base64?: string;
}

export interface ScrapedListing {
  mlsNumber: string;
  address: string;
  city: string;
  province: string;
  price: number;
  beds: number | null;
  baths: number | null;
  sqft: number | null;
  lotSize: string | null;
  propertyType: string | null;
  description: string | null;
  images: ScrapedImage[];
  scrapedAt: string;
  sourceUrl: string;
}

export interface ScrapeResult {
  success: boolean;
  listing?: ScrapedListing;
  error?: string;
}
