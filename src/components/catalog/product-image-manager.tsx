'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ImagePlus, Loader2, RefreshCw, Trash2 } from 'lucide-react';
import {
  backofficeApi,
  type BackofficeProductImage,
  type ProductImageUploadGrant,
} from '@/lib/api';

const MAX_IMAGES = 3;
const MAX_FILE_SIZE = 2 * 1024 * 1024;
const ACCEPTED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

type Operation = 'idle' | 'presigning' | 'uploading' | 'confirming';

interface PendingUpload {
  imageId: string;
  grant: ProductImageUploadGrant;
  uploaded: boolean;
}

interface ProductImageManagerProps {
  productId: string;
  productName: string;
  initialImages: BackofficeProductImage[];
}

function sortImages(images: BackofficeProductImage[]): BackofficeProductImage[] {
  return [...images].sort(
    (left, right) => left.sortOrder - right.sortOrder || left.imageId.localeCompare(right.imageId),
  );
}

function isGrantExpired(expiresAt: number | string): boolean {
  const value = typeof expiresAt === 'number'
    ? (expiresAt < 10_000_000_000 ? expiresAt * 1000 : expiresAt)
    : Date.parse(expiresAt);
  return !Number.isFinite(value) || value <= Date.now();
}
function putFile(
  file: File,
  grant: ProductImageUploadGrant,
  onProgress: (progress: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    if (Object.keys(grant.signedHeaders).some((name) => name.toLowerCase() === 'authorization')) {
      reject(new Error('La autorización de carga contiene un header no permitido'));
      return;
    }

    const xhr = new XMLHttpRequest();
    xhr.open('PUT', grant.uploadUrl);
    for (const [name, value] of Object.entries(grant.signedHeaders)) {
      xhr.setRequestHeader(name, value);
    }
    xhr.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    });
    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress(100);
        resolve();
      } else {
        reject(new Error('No se pudo transferir la imagen. Intenta nuevamente.'));
      }
    });
    xhr.addEventListener('error', () => reject(new Error('La conexión falló durante la carga.')));
    xhr.addEventListener('abort', () => reject(new Error('La carga fue cancelada.')));
    xhr.send(file);
  });
}

export function ProductImageManager({
  productId,
  productName,
  initialImages,
}: ProductImageManagerProps) {
  const [images, setImages] = useState(() => sortImages(initialImages));
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [pendingUpload, setPendingUpload] = useState<PendingUpload | null>(null);
  const [operation, setOperation] = useState<Operation>('idle');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [deletingIds, setDeletingIds] = useState<Set<string>>(() => new Set());
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setImages(sortImages(initialImages));
  }, [initialImages]);

  const atCapacity = images.length >= MAX_IMAGES;
  const isBusy = operation !== 'idle';
  const operationLabel = useMemo(() => {
    if (operation === 'presigning') return 'Preparando carga segura...';
    if (operation === 'uploading') return `Subiendo imagen: ${uploadProgress}%`;
    if (operation === 'confirming') return 'Confirmando imagen...';
    return null;
  }, [operation, uploadProgress]);

  function resetSelection() {
    setSelectedFile(null);
    setPendingUpload(null);
    setUploadProgress(0);
    if (inputRef.current) inputRef.current.value = '';
  }

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    setError(null);
    setMessage(null);
    setPendingUpload(null);
    setUploadProgress(0);

    if (!file) {
      setSelectedFile(null);
      return;
    }
    if (atCapacity) {
      setSelectedFile(null);
      setError('Este producto ya alcanzó el máximo de 3 imágenes.');
      event.target.value = '';
      return;
    }
    if (!ACCEPTED_TYPES.has(file.type)) {
      setSelectedFile(null);
      setError('Selecciona una imagen JPEG, PNG o WebP.');
      event.target.value = '';
      return;
    }
    if (file.size < 1 || file.size > MAX_FILE_SIZE) {
      setSelectedFile(null);
      setError('La imagen debe tener un tamaño entre 1 byte y 2 MiB.');
      event.target.value = '';
      return;
    }
    setSelectedFile(file);
  }
  async function uploadSelectedFile() {
    if (!selectedFile || isBusy || atCapacity) return;
    setError(null);
    setMessage(null);

    try {
      let pending = pendingUpload;
      if (!pending || (!pending.uploaded && isGrantExpired(pending.grant.expiresAt))) {
        setOperation('presigning');
        const grant = await backofficeApi.requestProductImageUpload(productId, {
          contentType: selectedFile.type,
          sizeBytes: selectedFile.size,
        });
        pending = { imageId: grant.imageId, grant, uploaded: false };
        setPendingUpload(pending);
      }

      if (!pending.uploaded) {
        setOperation('uploading');
        setUploadProgress(0);
        await putFile(selectedFile, pending.grant, setUploadProgress);
        pending = { ...pending, uploaded: true };
        setPendingUpload(pending);
      }

      setOperation('confirming');
      const confirmed = await backofficeApi.confirmProductImage(productId, pending.imageId);
      setImages((current) => sortImages([
        ...current.filter((image) => image.imageId !== confirmed.imageId),
        confirmed,
      ]));
      resetSelection();
      setMessage('Imagen cargada y confirmada correctamente.');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No se pudo completar la carga.');
    } finally {
      setOperation('idle');
    }
  }

  async function retryConfirmation(imageId: string) {
    if (isBusy) return;
    setOperation('confirming');
    setError(null);
    setMessage(null);
    try {
      const confirmed = await backofficeApi.confirmProductImage(productId, imageId);
      setImages((current) => sortImages([
        ...current.filter((image) => image.imageId !== confirmed.imageId),
        confirmed,
      ]));
      if (pendingUpload?.imageId === imageId) resetSelection();
      setMessage('La confirmación se completó correctamente.');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No se pudo confirmar la imagen.');
    } finally {
      setOperation('idle');
    }
  }
  async function deleteImage(image: BackofficeProductImage) {
    if (deletingIds.has(image.imageId)) return;
    const confirmed = window.confirm(`¿Eliminar la imagen de ${productName}?`);
    if (!confirmed) return;

    setDeletingIds((current) => new Set(current).add(image.imageId));
    setError(null);
    setMessage(null);
    try {
      await backofficeApi.deleteProductImage(productId, image.imageId);
      const refreshed = await backofficeApi.getProduct(productId);
      setImages(sortImages(refreshed.images ?? []));
      setMessage('Imagen eliminada correctamente.');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No se pudo eliminar la imagen.');
    } finally {
      setDeletingIds((current) => {
        const next = new Set(current);
        next.delete(image.imageId);
        return next;
      });
    }
  }

  return (
    <section
      className="bg-white rounded-xl border border-gray-200 p-6 space-y-5"
      aria-labelledby="product-images-title"
      data-testid="product-image-manager"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="product-images-title" className="text-lg font-semibold text-gray-900">
            Imágenes del producto
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            JPEG, PNG o WebP de hasta 2 MiB. La primera imagen será la principal.
          </p>
        </div>
        <p
          className={`text-sm font-medium ${atCapacity ? 'text-amber-700' : 'text-gray-500'}`}
          data-testid="product-image-capacity"
        >
          {images.length} de {MAX_IMAGES} imágenes
        </p>
      </div>

      <div className="rounded-lg border border-dashed border-gray-300 p-4 space-y-3">
        <label htmlFor="product-image-picker" className="block text-sm font-medium text-gray-700">
          Seleccionar imagen
        </label>
        <input
          ref={inputRef}
          id="product-image-picker"
          type="file"
          accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
          onChange={handleFileChange}
          disabled={atCapacity || isBusy}
          className="block w-full text-sm text-gray-600 file:mr-3 file:rounded-lg file:border-0 file:bg-brand-primary file:px-4 file:py-2 file:text-sm file:font-medium file:text-white disabled:opacity-50"
          data-testid="product-image-picker"
        />

        {/* Upload trigger — appears once a valid file is selected */}
        {selectedFile && operation === 'idle' && (
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-600 truncate">{selectedFile.name}</span>
            <button
              type="button"
              onClick={uploadSelectedFile}
              disabled={atCapacity || isBusy}
              className="ml-auto inline-flex items-center gap-2 rounded-lg bg-brand-primary px-4 py-2 text-sm font-medium text-white hover:bg-brand-primary/90 disabled:opacity-50"
              data-testid="image-upload-button"
            >
              <ImagePlus className="w-4 h-4" /> Subir imagen
            </button>
          </div>
        )}

        {/* Upload progress */}
        {operation !== 'idle' && (
          <div className="space-y-1" data-testid="image-upload-progress">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>
                {operation === 'presigning' && 'Solicitando autorización...'}
                {operation === 'uploading' && `Subiendo... ${uploadProgress}%`}
                {operation === 'confirming' && 'Confirmando imagen...'}
              </span>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden" role="progressbar" aria-valuenow={uploadProgress} aria-valuemin={0} aria-valuemax={100}>
              <div className="h-full bg-brand-primary transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
            </div>
          </div>
        )}
      </div>

      {/* Error / Success alerts */}
      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700" role="alert" data-testid="image-operation-error">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="ml-auto text-red-500 hover:text-red-700" aria-label="Cerrar error">✕</button>
        </div>
      )}
      {message && (
        <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700" role="status" aria-live="polite" data-testid="image-operation-success">
          <span>{message}</span>
        </div>
      )}

      {/* Image grid */}
      {images.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4" data-testid="product-image-grid">
          {images.map((img) => (
            <div
              key={img.imageId}
              className={`relative rounded-lg border overflow-hidden ${img.status !== 'ACTIVE' ? 'opacity-60' : ''} ${deletingIds.has(img.imageId) ? 'animate-pulse' : ''}`}
              data-testid={`product-image-card-${img.imageId}`}
            >
              <div className="aspect-square bg-gray-50">
                <img src={img.url} alt={img.altText || productName} className="w-full h-full object-cover" loading="lazy" />
              </div>
              {img.isPrimary && (
                <span className="absolute top-2 left-2 px-2 py-0.5 text-xs font-medium bg-brand-primary text-white rounded" data-testid="image-primary-badge">
                  Principal
                </span>
              )}
              {img.status !== 'ACTIVE' && (
                <span className="absolute top-2 right-2 px-2 py-0.5 text-xs font-medium bg-amber-100 text-amber-800 rounded">
                  {img.status === 'CONFIRMING' ? 'Confirmando' : 'Eliminando'}
                </span>
              )}
              <button
                onClick={() => deleteImage(img)}
                disabled={deletingIds.has(img.imageId) || isBusy}
                className="absolute bottom-2 right-2 p-1.5 bg-white/90 rounded-lg border border-gray-200 text-gray-500 hover:text-red-600 hover:border-red-200 disabled:opacity-50 transition-colors"
                aria-label={`Eliminar imagen ${img.imageId}`}
                data-testid="image-delete-button"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {images.length === 0 && operation === 'idle' && (
        <p className="text-center text-sm text-gray-400 py-6">
          Sin imágenes. Sube la primera para establecer la imagen principal.
        </p>
      )}
    </section>
  );
}
