'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { Loader2, Download, ImageIcon, Home, MapPin, DollarSign, Bed, Bath, Ruler, FileText, Check, Copy, FolderArchive } from 'lucide-react';
import JSZip from 'jszip';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

interface ScrapedImage {
  url: string;
  base64?: string;
}

interface ScrapedListing {
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

export default function ScrapePage() {
  const params = useParams();
  const accountId = params.accountId as string;

  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [listing, setListing] = useState<ScrapedListing | null>(null);
  const [selectedImage, setSelectedImage] = useState(0);
  const [selectedForDownload, setSelectedForDownload] = useState<Set<number>>(new Set());
  const [copied, setCopied] = useState(false);
  const [selectMode, setSelectMode] = useState(false);

  const handleScrape = async () => {
    if (!url.trim()) return;

    setLoading(true);
    setError(null);
    setListing(null);
    setSelectedForDownload(new Set());

    try {
      const res = await fetch('/api/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim() }),
      });

      const data = await res.json();

      if (!data.success) {
        throw new Error(data.error || 'Scrape failed');
      }

      setListing(data.listing);
      setSelectedImage(0);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const downloadJson = () => {
    if (!listing) return;
    const cleanListing = {
      ...listing,
      images: listing.images.map(img => ({ url: img.url })),
    };
    const blob = new Blob([JSON.stringify(cleanListing, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `listing-${listing.mlsNumber}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getCleanListing = () => {
    if (!listing) return null;
    return {
      ...listing,
      images: listing.images.map(img => ({ url: img.url, hasData: !!img.base64 })),
    };
  };

  const copyJson = async () => {
    const clean = getCleanListing();
    if (!clean) return;
    await navigator.clipboard.writeText(JSON.stringify(clean, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadImage = (img: ScrapedImage, index: number) => {
    if (!img.base64) return;
    const a = document.createElement('a');
    a.href = img.base64;
    a.download = `${listing?.mlsNumber || 'listing'}-photo-${index + 1}.jpg`;
    a.click();
  };

  const getFolderName = () => {
    if (!listing) return 'listing';
    const parts = [listing.mlsNumber, listing.address, listing.city].filter(Boolean);
    return parts.join(' - ').replace(/[<>:"/\\|?*]/g, '').trim() || 'listing';
  };

  const downloadAsZip = async (indices?: number[]) => {
    if (!listing) return;

    const zip = new JSZip();
    const folderName = getFolderName();
    const folder = zip.folder(folderName);
    if (!folder) return;

    const imagesToDownload = indices
      ? indices.map(i => ({ img: listing.images[i], index: i })).filter(x => x.img?.base64)
      : listing.images.map((img, index) => ({ img, index })).filter(x => x.img.base64);

    for (const { img, index } of imagesToDownload) {
      if (!img.base64) continue;
      const base64Data = img.base64.split(',')[1];
      const fileName = `photo-${String(index + 1).padStart(2, '0')}.jpg`;
      folder.file(fileName, base64Data, { base64: true });
    }

    const blob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${folderName}.zip`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const toggleImageSelection = (index: number) => {
    setSelectedForDownload(prev => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 0 }).format(price);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Scrape Listing</h1>
        <p className="text-muted-foreground">
          Paste a Paragon MLS URL to extract listing data for {accountId}
        </p>
      </div>

      {/* Input */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-3">
            <Input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://nsar.paragonrels.com/..."
              onKeyDown={(e) => e.key === 'Enter' && handleScrape()}
              className="flex-1"
            />
            <Button onClick={handleScrape} disabled={loading || !url.trim()}>
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                'Scrape'
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Error */}
      {error && (
        <Card className="border-destructive">
          <CardContent className="pt-6 text-destructive">
            {error}
          </CardContent>
        </Card>
      )}

      {/* Results */}
      {listing && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <Badge variant="secondary" className="mb-2">MLS# {listing.mlsNumber}</Badge>
                <CardTitle className="flex items-center gap-2">
                  <Home className="h-5 w-5 text-muted-foreground" />
                  {listing.address || 'Address not found'}
                </CardTitle>
                <CardDescription className="flex items-center gap-1 mt-1">
                  <MapPin className="h-4 w-4" />
                  {listing.city}, {listing.province}
                </CardDescription>
              </div>
              <div className="text-right">
                <div className="text-3xl font-bold text-green-600 flex items-center gap-1">
                  <DollarSign className="h-6 w-6" />
                  {listing.price ? formatPrice(listing.price).replace('$', '') : 'N/A'}
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Main Image */}
            <div className="relative w-full h-[400px] bg-muted rounded-lg overflow-hidden">
              {listing.images[selectedImage]?.base64 ? (
                <img
                  src={listing.images[selectedImage].base64}
                  alt={`Photo ${selectedImage + 1}`}
                  className="w-full h-full object-contain"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <ImageIcon className="h-12 w-12 text-muted-foreground" />
                </div>
              )}
              <Badge className="absolute bottom-3 right-3" variant="secondary">
                {selectedImage + 1} / {listing.images.length}
              </Badge>
            </div>

            {/* Thumbnails */}
            {listing.images.length > 1 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Button
                    variant={selectMode ? "default" : "outline"}
                    size="sm"
                    onClick={() => {
                      setSelectMode(!selectMode);
                      if (selectMode) setSelectedForDownload(new Set());
                    }}
                  >
                    {selectMode ? <Check className="h-4 w-4 mr-1" /> : null}
                    {selectMode ? 'Select Mode ON' : 'Select Multiple'}
                  </Button>
                  {selectMode && selectedForDownload.size > 0 && (
                    <Button size="sm" onClick={() => downloadAsZip(Array.from(selectedForDownload))}>
                      <FolderArchive className="h-4 w-4 mr-1" />
                      Download {selectedForDownload.size} as ZIP
                    </Button>
                  )}
                  {selectMode && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        if (selectedForDownload.size === listing.images.length) {
                          setSelectedForDownload(new Set());
                        } else {
                          setSelectedForDownload(new Set(listing.images.map((_, i) => i)));
                        }
                      }}
                    >
                      {selectedForDownload.size === listing.images.length ? 'Deselect All' : 'Select All'}
                    </Button>
                  )}
                </div>
                <div className="flex gap-2 overflow-x-auto pb-2">
                  {listing.images.map((img, i) => (
                    <button
                      key={i}
                      onClick={() => {
                        if (selectMode) {
                          toggleImageSelection(i);
                        } else {
                          setSelectedImage(i);
                        }
                      }}
                      className={`relative w-16 h-16 rounded-md overflow-hidden flex-shrink-0 border-2 ${
                        selectMode
                          ? selectedForDownload.has(i) ? 'border-green-500' : 'border-muted'
                          : i === selectedImage ? 'border-primary' : 'border-transparent'
                      }`}
                    >
                      {img.base64 ? (
                        <img src={img.base64} alt={`Thumb ${i + 1}`} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-muted flex items-center justify-center">
                          <ImageIcon className="h-4 w-4 text-muted-foreground" />
                        </div>
                      )}
                      {selectMode && selectedForDownload.has(i) && (
                        <div className="absolute inset-0 bg-green-500/50 flex items-center justify-center">
                          <Check className="h-5 w-5 text-white" />
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Specs */}
            <div className="flex flex-wrap gap-4">
              {listing.beds !== null && (
                <div className="flex items-center gap-2 text-sm">
                  <Bed className="h-4 w-4 text-muted-foreground" />
                  <span>{listing.beds} bed{listing.beds !== 1 ? 's' : ''}</span>
                </div>
              )}
              {listing.baths !== null && (
                <div className="flex items-center gap-2 text-sm">
                  <Bath className="h-4 w-4 text-muted-foreground" />
                  <span>{listing.baths} bath{listing.baths !== 1 ? 's' : ''}</span>
                </div>
              )}
              {listing.sqft !== null && (
                <div className="flex items-center gap-2 text-sm">
                  <Ruler className="h-4 w-4 text-muted-foreground" />
                  <span>{listing.sqft.toLocaleString()} sqft</span>
                </div>
              )}
              {listing.lotSize && (
                <div className="flex items-center gap-2 text-sm">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <span>{listing.lotSize}</span>
                </div>
              )}
            </div>

            {/* Description */}
            {listing.description && (
              <div className="flex gap-3 p-4 bg-muted rounded-lg">
                <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                <p className="text-sm text-muted-foreground">{listing.description}</p>
              </div>
            )}

            {/* Actions */}
            <div className="flex flex-wrap gap-2 pt-4 border-t">
              <Button variant="outline" size="sm" onClick={downloadJson}>
                <Download className="h-4 w-4 mr-1" />
                Download JSON
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => downloadImage(listing.images[selectedImage], selectedImage)}
                disabled={!listing.images[selectedImage]?.base64}
              >
                <ImageIcon className="h-4 w-4 mr-1" />
                Download Photo {selectedImage + 1}
              </Button>
              <Button size="sm" onClick={() => downloadAsZip()}>
                <FolderArchive className="h-4 w-4 mr-1" />
                Download All as ZIP ({listing.images.filter(img => img.base64).length})
              </Button>
            </div>

            {/* Raw JSON */}
            <details className="border-t pt-4">
              <summary className="text-sm text-muted-foreground cursor-pointer">Raw JSON</summary>
              <div className="mt-2 flex justify-end">
                <Button variant="outline" size="sm" onClick={copyJson}>
                  {copied ? <Check className="h-4 w-4 mr-1" /> : <Copy className="h-4 w-4 mr-1" />}
                  {copied ? 'Copied!' : 'Copy JSON'}
                </Button>
              </div>
              <pre className="mt-2 p-4 bg-muted rounded-lg text-xs overflow-auto max-h-[300px]">
                {JSON.stringify(getCleanListing(), null, 2)}
              </pre>
            </details>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
