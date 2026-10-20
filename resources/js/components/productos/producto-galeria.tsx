import { ChevronLeft, ChevronRight, ImageOff } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';

type Props = {
    /** Image URLs in their order: the first one is the cover. */
    imagenes: string[];
    alt: string;
    className?: string;
};

/**
 * Store-like gallery: a big image with arrows to move between them and the
 * thumbnails below to jump to one.
 */
export default function ProductoGaleria({ imagenes, alt, className }: Props) {
    const [actual, setActual] = useState(0);
    const total = imagenes.length;

    if (total === 0) {
        return (
            <div
                className={cn(
                    'bg-muted text-muted-foreground flex aspect-square w-full flex-col items-center justify-center gap-2 rounded-lg border text-sm',
                    className,
                )}
            >
                <ImageOff className="size-8" />
                Sin imagen
            </div>
        );
    }

    const mover = (paso: number) => setActual((total + actual + paso) % total);

    return (
        <div
            className={cn('space-y-2', className)}
            data-test="producto-galeria"
        >
            <div className="bg-muted group/galeria relative aspect-square w-full overflow-hidden rounded-lg border">
                <img
                    src={imagenes[actual]}
                    alt={`${alt} (${actual + 1} de ${total})`}
                    className="h-full w-full object-contain"
                />

                {total > 1 ? (
                    <>
                        <button
                            type="button"
                            aria-label="Imagen anterior"
                            onClick={() => mover(-1)}
                            data-test="producto-galeria-anterior"
                            className="bg-background/80 hover:bg-background absolute top-1/2 left-2 -translate-y-1/2 rounded-full border p-1 shadow-sm transition-opacity sm:opacity-0 sm:group-hover/galeria:opacity-100"
                        >
                            <ChevronLeft className="size-5" />
                        </button>
                        <button
                            type="button"
                            aria-label="Imagen siguiente"
                            onClick={() => mover(1)}
                            data-test="producto-galeria-siguiente"
                            className="bg-background/80 hover:bg-background absolute top-1/2 right-2 -translate-y-1/2 rounded-full border p-1 shadow-sm transition-opacity sm:opacity-0 sm:group-hover/galeria:opacity-100"
                        >
                            <ChevronRight className="size-5" />
                        </button>
                        <span className="bg-background/80 absolute right-2 bottom-2 rounded-full px-2 py-0.5 text-xs tabular-nums">
                            {actual + 1} / {total}
                        </span>
                    </>
                ) : null}
            </div>

            {total > 1 ? (
                <div className="flex gap-2 overflow-x-auto pb-1">
                    {imagenes.map((url, indice) => (
                        <button
                            key={url}
                            type="button"
                            aria-label={`Ver imagen ${indice + 1}`}
                            onClick={() => setActual(indice)}
                            data-test="producto-galeria-miniatura"
                            className={cn(
                                'bg-muted size-14 shrink-0 overflow-hidden rounded-md border-2 transition',
                                indice === actual
                                    ? 'border-primary'
                                    : 'border-transparent opacity-70 hover:opacity-100',
                            )}
                        >
                            <img
                                src={url}
                                alt=""
                                loading="lazy"
                                className="h-full w-full object-cover"
                            />
                        </button>
                    ))}
                </div>
            ) : null}
        </div>
    );
}
